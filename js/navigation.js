/**
 * İstanbul Bakırköy Capacity AVM - Çok Katlı İç Mekan Mikro-Navigasyon Motoru
 * Min-Priority Queue Dijkstra Yol Bulma & Adım Adım Türkçe Yönlendirme Algoritması
 */

class PriorityQueue {
  constructor() {
    this.values = [];
  }

  enqueue(val, priority) {
    this.values.push({ val, priority });
    this.sort();
  }

  dequeue() {
    return this.values.shift();
  }

  sort() {
    this.values.sort((a, b) => a.priority - b.priority);
  }

  isEmpty() {
    return this.values.length === 0;
  }
}

class NavigationEngine {
  constructor(mallData) {
    this.mallData = mallData;
    this.nodes = mallData.graph.nodes;
    this.adj = mallData.graph.adj;
    this.floors = mallData.floors;
    this.entrances = mallData.entrances;
    this.mPerUnit = mallData.meta?.mPerUnit || 0.48;
  }

  /**
   * İki düğüm arasında en kısa yolu Dijkstra ile hesaplar
   * @param {string} startNodeId 
   * @param {string} targetNodeId 
   * @param {string} mode - 'escalator' | 'elevator' | 'both'
   * @param {string} pathFilter - 'wide' | 'short'
   * @returns {Object} { totalDistance, estimatedMinutes, pathNodes, segmentsByFloor, instructions, mode, pathFilter, fallbackUsed }
   */
  findRoute(startNodeId, targetNodeId, mode = 'escalator', pathFilter = 'wide') {
    if (!startNodeId || !targetNodeId) {
      return null;
    }

    // Hedef ile başlangıç aynı noktaysa anında sıfır mesafeli varış dön
    if (startNodeId === targetNodeId) {
      const nodeData = this.nodes[startNodeId];
      if (!nodeData) return null;
      return {
        totalDistance: 0,
        totalUnits: 0,
        estimatedMinutes: 0,
        pathNodes: [{
          id: startNodeId,
          floor: nodeData.floor,
          x: nodeData.x,
          y: nodeData.y,
          edgeType: 'start'
        }],
        segmentsByFloor: {
          [nodeData.floor]: [{
            id: startNodeId,
            floor: nodeData.floor,
            x: nodeData.x,
            y: nodeData.y
          }]
        },
        instructions: [{
          step: 1,
          type: 'destination',
          icon: 'check-circle',
          floor: nodeData.floor,
          text: 'Şu anda hedefin yanındasınız.'
        }],
        mode,
        pathFilter
      };
    }

    // 1. Seçilen mod ve yol filtresi (wide / short) ile dene
    let result = this._runDijkstra(startNodeId, targetNodeId, mode, pathFilter);

    // 2. Eğer geniş yol filtresiyle rota bulunamazsa 'short' (tüm yollar) ile fallback yap
    if (!result && pathFilter === 'wide') {
      result = this._runDijkstra(startNodeId, targetNodeId, mode, 'short');
    }

    // 3. Eğer tekil modla rota bulunamazsa kullanıcıyı yolda bırakmamak için otomatik olarak 'both' fallback
    if (!result && mode !== 'both') {
      result = this._runDijkstra(startNodeId, targetNodeId, 'both', pathFilter);
      if (!result && pathFilter === 'wide') {
        result = this._runDijkstra(startNodeId, targetNodeId, 'both', 'short');
      }
      if (result) {
        result.fallbackUsed = true;
      }
    }

    if (result) {
      result.pathFilter = pathFilter;
    }

    return result;
  }

  _runDijkstra(startNodeId, targetNodeId, mode, pathFilter = 'wide') {
    const dist = {};
    const prev = {};
    const pq = new PriorityQueue();

    dist[startNodeId] = 0;
    pq.enqueue(startNodeId, 0);

    const allowedTransfers = mode === 'escalator' 
      ? ['escalator', 'stairs'] 
      : mode === 'elevator' 
        ? ['elevator'] 
        : ['escalator', 'stairs', 'elevator'];

    const startFloor = this.nodes[startNodeId]?.floor;
    const targetFloor = this.nodes[targetNodeId]?.floor;
    const isSameFloorRoute = startFloor !== undefined && targetFloor !== undefined && startFloor === targetFloor;

    while (!pq.isEmpty()) {
      const { val: u, priority: currentDist } = pq.dequeue();

      if (u === targetNodeId) {
        return this._buildRouteResult(startNodeId, targetNodeId, prev, currentDist, mode);
      }

      if (currentDist > dist[u]) continue;

      const neighbors = this.adj[u] || [];
      for (const edge of neighbors) {
        const v = edge.to;
        const edgeType = edge.type || 'main';

        // Rota Filtreleme: "Geniş Yol" (wide) seçildiğinde "narrow" etiketli yolları ağdan geçici olarak çıkar
        if (pathFilter === 'wide' && edgeType === 'narrow') {
          continue;
        }

        // Mod filtreleme: Dikey kenarlarda yürüyen merdiven vs asansör kuralı
        const isTransfer = edge.portalKind || edgeType === 'escalator' || edgeType === 'elevator' || edgeType === 'stairs';
        if (isTransfer) {
          const transferType = edge.portalKind || edgeType;
          if (!allowedTransfers.includes(transferType)) {
            continue;
          }
        }

        // Havuz Bypass Koruması: Zemin katta (Floor 4) 'Müzikli Gösteri Havuzu' su poligonunun üzerinden transit geçişi engelle
        const isPoolTransit = (nid) => {
          if (nid === startNodeId || nid === targetNodeId) return false;
          if (nid === 'c_4_m_700') return true;
          const nd = this.nodes[nid];
          if (nd && nd.floor === 4) {
            const dx = (nd.x - 700) / 75;
            const dy = (nd.y - 440) / 50;
            if (dx * dx + dy * dy < 1.0) return true;
          }
          return false;
        };
        const poolPenalty = isPoolTransit(v) ? 9999 : 0;

        // Dikey geçiş cezası (Gerçek dünya modeli: bekleme ve binme süresi).
        // Başlangıç ve hedef aynı kattaysa gereksiz alt/üst kata inip çıkmayı engeller.
        const transferPenalty = isTransfer ? 200 : 0;
        const sameFloorPenalty = (isTransfer && isSameFloorRoute) ? 600 : 0;
        const edgeWeight = edge.dist + transferPenalty + sameFloorPenalty + poolPenalty;

        const alt = currentDist + edgeWeight;
        if (dist[v] === undefined || alt < dist[v]) {
          dist[v] = alt;
          prev[v] = { from: u, edge };
          pq.enqueue(v, alt);
        }
      }
    }

    return null;
  }

  _buildRouteResult(startNodeId, targetNodeId, prev, totalDist, mode) {
    const pathNodeIds = [];
    let curr = targetNodeId;

    while (curr) {
      pathNodeIds.unshift(curr);
      curr = prev[curr] ? prev[curr].from : null;
    }

    let actualPhysicalDist = 0;
    const pathNodes = pathNodeIds.map((nid, idx) => {
      const nodeData = this.nodes[nid];
      const prevEdge = idx > 0 ? prev[nid]?.edge : null;
      if (prevEdge && prevEdge.dist) {
        actualPhysicalDist += prevEdge.dist;
      }
      return {
        id: nid,
        floor: nodeData.floor,
        x: nodeData.x,
        y: nodeData.y,
        edgeType: prevEdge ? prevEdge.type : 'start',
        portalKind: prevEdge ? prevEdge.portalKind : null
      };
    });

    const finalDist = actualPhysicalDist > 0 ? actualPhysicalDist : totalDist;

    // Kat bazlı segmentlere böl
    const segmentsByFloor = {};
    for (const pNode of pathNodes) {
      if (!segmentsByFloor[pNode.floor]) {
        segmentsByFloor[pNode.floor] = [];
      }
      segmentsByFloor[pNode.floor].push(pNode);
    }

    // Kat bazlı kesintisiz segment dizisi (aynı kattaki ardışık noktalar zinciri)
    const segments = [];
    let curSeg = null;
    for (let i = 0; i < pathNodes.length; i++) {
      const pNode = pathNodes[i];
      if (!curSeg || curSeg.floor !== pNode.floor) {
        curSeg = { floor: pNode.floor, points: [] };
        segments.push(curSeg);
      }
      curSeg.points.push({ x: pNode.x, y: pNode.y, id: pNode.id, edgeType: pNode.edgeType });
    }

    // Metre ve süre hesabı
    const totalMeters = Math.round(finalDist * this.mPerUnit);
    const estimatedMinutes = Math.max(1, Math.ceil(totalMeters / 60)); // ~1 m/s = 60 m/dk

    // Doğal dil Türkçe yönlendirme talimatları ve yol üstü (en-route) mağaza referansları
    const { instructions, enRouteStoreIds, enRouteStoreNames } = this._generateInstructions(pathNodes, startNodeId, targetNodeId);

    return {
      totalDistance: totalMeters,
      totalUnits: Math.round(totalDist),
      estimatedMinutes,
      pathNodes,
      path: pathNodes,
      segments,
      segmentsByFloor,
      instructions,
      enRouteStoreIds,
      enRouteStoreNames,
      mode
    };
  }

  /**
   * Bir noktanın (px, py) [ax, ay] -> [bx, by] doğru parçasına olan en kısa mesafesini ve izdüşüm oranını (t: 0..1) hesaplar
   */
  _pointToSegmentProjection(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      return { dist: Math.hypot(px - ax, py - ay), t: 0 };
    }
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + t * dx;
    const projY = ay + t * dy;
    return { dist: Math.hypot(px - projX, py - projY), t };
  }

  /**
   * Verilen yürüyüş dilimindeki (startIdx -> endIdx) koridor boyunca yanından geçilen mağazaları yürüyüş sırasına göre bulur
   */
  _getPassingStoresForRange(pathNodes, startIdx, endIdx, excludeNavNodes = new Set()) {
    if (!pathNodes || startIdx >= endIdx) return [];
    const floor = pathNodes[startIdx]?.floor;
    const floorStores = this.floors[floor]?.stores || [];
    if (!floorStores.length) return [];

    const collectMatches = (maxDoorDist) => {
      const matched = new Map(); // store.id -> { store, orderScore, minDist }
      for (let idx = startIdx; idx < endIdx; idx++) {
        const u = pathNodes[idx];
        const v = pathNodes[idx + 1];
        if (!u || !v || u.floor !== floor || v.floor !== floor) continue;

        const segLen = Math.hypot(v.x - u.x, v.y - u.y);
        if (segLen < 22) continue; // Kapı önü 3-4 metrelik mikro adımlarda mağaza eşleştirme

        for (const s of floorStores) {
          if (excludeNavNodes.has(s.nav_node)) continue;

          const doorX = s.door_x !== undefined ? s.door_x : s.cx;
          const doorY = s.door_y !== undefined ? s.door_y : s.cy;
          const pDoor = this._pointToSegmentProjection(doorX, doorY, u.x, u.y, v.x, v.y);

          if (pDoor.dist <= maxDoorDist && pDoor.t >= 0.04 && pDoor.t <= 0.96) {
            const orderScore = idx + pDoor.t;
            const prev = matched.get(s.id);
            if (!prev || pDoor.dist < prev.minDist) {
              matched.set(s.id, {
                store: s,
                orderScore: prev ? Math.min(prev.orderScore, orderScore) : orderScore,
                minDist: pDoor.dist
              });
            }
          }
        }
      }
      return Array.from(matched.values())
        .sort((a, b) => a.orderScore - b.orderScore)
        .map(item => item.store);
    };

    // Önce koridor cephesindeki (kapısı koridora <= 28 birim mesafedeki) doğrudan komşu mağazaları bul
    const directMatches = collectMatches(28);
    if (directMatches.length > 0) {
      return directMatches;
    }
    // Doğrudan cephe mağazası yoksa yakın çevredeki (<= 46 birim) mağazaları döndür
    return collectMatches(46);
  }

  _generateInstructions(pathNodes, startNodeId = null, targetNodeId = null) {
    const instructions = [];
    const enRouteStoreIdSet = new Set();
    const enRouteStoreNames = [];

    if (!pathNodes || pathNodes.length === 0) {
      return { instructions, enRouteStoreIds: [], enRouteStoreNames: [] };
    }

    const excludeEndpoints = new Set([startNodeId, targetNodeId].filter(Boolean));

    const recordPassingStores = (stores) => {
      const names = [];
      for (const s of stores) {
        if (!s || !s.id) continue;
        if (!enRouteStoreIdSet.has(s.id)) {
          enRouteStoreIdSet.add(s.id);
          enRouteStoreNames.push(s.name);
        }
        if (!names.includes(s.name)) {
          names.push(s.name);
        }
      }
      return names;
    };

    const formatPassingPhrase = (storeNames, walkMeters, isFinalStretch = false) => {
      const picked = storeNames.slice(0, 3);
      const prefix = isFinalStretch ? `Son ${walkMeters} m` : `${walkMeters} m`;
      if (picked.length >= 2) {
        return `${picked.slice(0, 2).join(' ve ')} mağazalarını geçerek ${prefix} düz ilerleyin.`;
      } else if (picked.length === 1) {
        return `${picked[0]} mağazasını geçerek ${prefix} düz ilerleyin.`;
      }
      return isFinalStretch ? `Son ${walkMeters} m düz ilerleyin.` : `Koridorda ${walkMeters} m düz ilerleyin.`;
    };

    const getNearbyStoreName = (floor, x, y) => {
      const floorStores = this.floors[floor]?.stores || [];
      let best = null;
      let minD = 55;
      for (const s of floorStores) {
        if (excludeEndpoints.has(s.nav_node)) continue;
        const doorX = s.door_x !== undefined ? s.door_x : s.cx;
        const doorY = s.door_y !== undefined ? s.door_y : s.cy;
        const d = Math.min(Math.hypot(s.cx - x, s.cy - y), Math.hypot(doorX - x, doorY - y));
        if (d < minD) {
          minD = d;
          best = s;
        }
      }
      if (best) {
        recordPassingStores([best]);
        return best.name;
      }
      return null;
    };

    let stepNum = 1;
    let currentFloor = pathNodes[0].floor;
    let accumulatedWalk = 0;
    let walkStartIndex = 0;

    const startText = `${this._getFloorLabel(currentFloor)} üzerinde harekete başlayın.`;
    instructions.push({
      step: stepNum++,
      nodeIndex: 0,
      type: 'start',
      icon: 'map-pin',
      emoji: '📍',
      floor: currentFloor,
      passingStores: [],
      text: startText,
      voiceText: startText
    });

    for (let i = 0; i < pathNodes.length - 1; i++) {
      const u = pathNodes[i];
      const v = pathNodes[i + 1];

      // Kat Değişimi
      if (u.floor !== v.floor) {
        if (accumulatedWalk > 5) {
          const walkMeters = Math.round(accumulatedWalk * this.mPerUnit);
          const passedObjs = this._getPassingStoresForRange(pathNodes, walkStartIndex, i, excludeEndpoints);
          const passedNames = recordPassingStores(passedObjs);
          const stepText = formatPassingPhrase(passedNames, walkMeters, false);
          instructions.push({
            step: stepNum++,
            nodeIndex: walkStartIndex,
            type: 'straight',
            icon: 'arrow-up',
            emoji: '⬆️',
            floor: u.floor,
            meters: walkMeters,
            passingStores: passedNames.slice(0, 3),
            text: stepText,
            voiceText: stepText
          });
          accumulatedWalk = 0;
        }

        const isElevator = v.edgeType === 'elevator' || v.portalKind === 'elevator';
        const portalText = isElevator ? 'Asansör ile' : 'Yürüyen merdiven ile';
        const dirText = v.floor > u.floor ? 'çıkın' : 'inin';
        const fcText = `${portalText} ${this._getFloorLabel(v.floor)} katına ${dirText}.`;

        instructions.push({
          step: stepNum++,
          nodeIndex: i,
          type: 'floor_change',
          icon: isElevator ? 'arrow-up-down' : 'layers',
          emoji: isElevator ? '🛗' : '🪜',
          floor: v.floor,
          fromFloor: u.floor,
          toFloor: v.floor,
          passingStores: [],
          text: fcText,
          voiceText: fcText
        });

        currentFloor = v.floor;
        walkStartIndex = i + 1;
        continue;
      }

      // Aynı kat içi yürüyüş
      const stepDist = Math.hypot(v.x - u.x, v.y - u.y);
      accumulatedWalk += stepDist;

      // Kapıdan koridora ilk çıkış adımında (i === 0 ve mesafe < 25 birim) gereksiz 3-4m dönüş üretme
      if (i === 0 && stepDist < 25) {
        continue;
      }
      // Hedef mağaza kapısına son giriş adımında (i === pathNodes.length - 2 ve son adım < 25 birim) gereksiz dönüş üretme
      if (i === pathNodes.length - 2) {
        const finalStepDist = Math.hypot(pathNodes[i + 1].x - v.x, pathNodes[i + 1].y - v.y);
        if (finalStepDist < 25) {
          continue;
        }
      }

      // Viraj / Dönüş Kontrolü
      if (i < pathNodes.length - 2 && pathNodes[i + 2].floor === currentFloor) {
        const next = pathNodes[i + 2];
        const nextStepDist = Math.hypot(next.x - v.x, next.y - v.y);
        if (nextStepDist < 25 && i + 2 === pathNodes.length - 1) {
          continue;
        }
        const angle1 = Math.atan2(v.y - u.y, v.x - u.x);
        const angle2 = Math.atan2(next.y - v.y, next.x - v.x);
        let diff = (angle2 - angle1) * (180 / Math.PI);
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;

        if (Math.abs(diff) >= 40) {
          if (accumulatedWalk > 5) {
            const walkMeters = Math.round(accumulatedWalk * this.mPerUnit);
            const passedObjs = this._getPassingStoresForRange(pathNodes, walkStartIndex, i + 1, excludeEndpoints);
            const passedNames = recordPassingStores(passedObjs);
            const stepText = formatPassingPhrase(passedNames, walkMeters, false);
            instructions.push({
              step: stepNum++,
              nodeIndex: walkStartIndex,
              type: 'straight',
              icon: 'arrow-up',
              emoji: '⬆️',
              floor: currentFloor,
              meters: walkMeters,
              passingStores: passedNames.slice(-3),
              text: stepText,
              voiceText: stepText
            });
            accumulatedWalk = 0;
          }

          const isRight = diff > 0;
          const nearbyLandmark = getNearbyStoreName(currentFloor, v.x, v.y);
          const landmarkSuffix = nearbyLandmark ? ` (${nearbyLandmark})` : '';
          const turnText = isRight ? `Sağa dönün${landmarkSuffix}.` : `Sola dönün${landmarkSuffix}.`;
          const turnVoice = nearbyLandmark
            ? `${nearbyLandmark} hizasından ${isRight ? 'sağa' : 'sola'} dönün.`
            : `${isRight ? 'Sağa' : 'Sola'} dönün.`;

          instructions.push({
            step: stepNum++,
            nodeIndex: i + 1,
            type: isRight ? 'turn_right' : 'turn_left',
            icon: isRight ? 'corner-up-right' : 'corner-up-left',
            emoji: isRight ? '↪️' : '↩️',
            floor: currentFloor,
            landmark: nearbyLandmark,
            passingStores: nearbyLandmark ? [nearbyLandmark] : [],
            text: turnText,
            voiceText: turnVoice
          });

          walkStartIndex = i + 1;
        }
      }
    }

    if (accumulatedWalk > 5) {
      const walkMeters = Math.round(accumulatedWalk * this.mPerUnit);
      const passedObjs = this._getPassingStoresForRange(pathNodes, walkStartIndex, pathNodes.length - 1, excludeEndpoints);
      const passedNames = recordPassingStores(passedObjs);
      const stepText = formatPassingPhrase(passedNames, walkMeters, true);
      instructions.push({
        step: stepNum++,
        nodeIndex: walkStartIndex,
        type: 'straight',
        icon: 'arrow-up',
        emoji: '⬆️',
        floor: currentFloor,
        meters: walkMeters,
        passingStores: passedNames.slice(-3),
        text: stepText,
        voiceText: stepText
      });
    }

    instructions.push({
      step: stepNum++,
      nodeIndex: pathNodes.length - 1,
      type: 'destination',
      icon: 'check-circle-2',
      emoji: '🎯',
      floor: pathNodes[pathNodes.length - 1].floor,
      passingStores: [],
      text: 'Hedefinize ulaştınız.',
      voiceText: 'Hedefinize ulaştınız. Keyifli alışverişler dileriz.'
    });

    return {
      instructions,
      enRouteStoreIds: Array.from(enRouteStoreIdSet),
      enRouteStoreNames
    };
  }

  _getFloorLabel(floorNum) {
    return this.floors[floorNum]?.label || `${floorNum}. Kat`;
  }
}

