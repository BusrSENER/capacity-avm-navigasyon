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

const ttsPronunciationMap = {
  'W Collection': 'Dabılyu Kolekşın',
  'Tommy Hilfiger': 'Tomi Hilfiger',
  'English Home': 'İngliş Hom',
  'Madame Coco': 'Madam Koko',
  'Marks & Spencer': 'Marks end Spensır',
  'Pull&Bear': 'Pul end Ber',
  'Pull & Bear': 'Pul end Ber',
  'U.S. Polo Assn.': 'Yu Es Polo',
  'US Polo': 'Yu Es Polo',
  'M·A·C': 'Mek',
  'MAC': 'Mek',
  'Mac': 'Mek',
  'Yves Rocher': 'İv Roşe',
  "L'Occitane": 'Loksitan',
  'SuperStep': 'Süper Step',
  'Sneaks Up': 'Sniks Ap',
  'Skechers': 'Skeçırs',
  'Pierre Cardin': 'Piyer Kardin',
  'The North Face': 'Dı Nort Feys',
  'Burger King': 'Börgır King',
  'HD İskender': 'He De İskender',
  'Tchibo': 'Çibo',
  'Blue Diamond': 'Mavi Elmas',
  'D&R': 'De ve Er',
  'D & R': 'De ve Er',
  'LCWaikiki': 'El Si Vaykiki',
  'LC Waikiki': 'El Si Vaykiki',
  'H&M': 'Haş ve Em',
  'B&G Store': 'Be ve Ge Stor',
  'Jack & Jones': 'Cek end Cons',
  'Saat & Saat': 'Saat ve Saat',
  'Sephora': 'Sefora',
  'DeFacto': 'Defakto',
  "Victoria's Secret": 'Viktoryaz Sikrıt',
  'Stradivarius': 'Stradivaryus',
  'Bershka': 'Berşka',
  'Oysho': 'Oyşo',
  'Beymen Club': 'Beymen Klab',
  'Paribu Cineverse': 'Paribu Sinevörs',
  'KFC': 'Key Ef Si',
  "Arby's": 'Arbis',
  'Popeyes': 'Popays',
  "Carl's Jr.": 'Karls Cunyır',
  "McDonald's": 'Mekdanılds',
  'Subway': 'Sabvey',
  'Starbucks': 'Starbaks',
  'Caribou Coffee': 'Karibu Kofi',
  'Caffè Nero': 'Kafe Nero',
  'Cafe Nero': 'Kafe Nero',
  'Cold Stone': 'Kold Ston',
  'Krispy Kreme': 'Krispi Krim',
  'Rossmann': 'Rosman',
  'Watsons': 'Vatsıns',
  'Golden Rose': 'Goldın Roz',
  'Timberland': 'Timbırlend',
  'New Balance': 'Niv Balans',
  'Under Armour': 'Andır Armır',
  'Nine West': 'Nayn Vest',
  'MediaMarkt': 'Medya Markt',
  'Mi Store': 'Mi Stor',
  'Apple': 'Epıl',
  'Dyson': 'Daysın',
  'Swarovski': 'Svarovski',
  'Swatch': 'Svoç',
  'Toyzz Shop': 'Toyz Şop',
  'Mothercare': 'Madırkeyr',
  'Chicco': 'Kiko',
  'Flying Tiger': 'Flaying Taygır',
  'Samsonite': 'Semsonayt',
  "Levi's": 'Livays',
  'Calvin Klein': 'Kalvin Klayn',
  'Guess': 'Ges',
  'Lacoste': 'Lakost',
  'Nautica': 'Notika',
  'Calzedonia': 'Kalzedonya',
  'Suwen': 'Suven',
  'Cookshop': 'Kukşop',
  'The Hunger': 'Dı Hangır',
  'Storks Diamond': 'Storks Daymınd',
  'G Lingerie': 'Ci Lanjeri',
  'So Chic': 'So Şik',
  'Sunglass Hut': 'Sanglas Hat',
  'Cacharel': 'Kaşarel'
};

function normalizeStorePronunciation(rawText) {
  if (!rawText) return '';
  let result = String(rawText);
  for (const [brand, phonetic] of Object.entries(ttsPronunciationMap)) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = /^[A-Za-z0-9]+$/.test(brand)
      ? new RegExp(`\\b${escaped}\\b`, 'gi')
      : new RegExp(escaped, 'gi');
    result = result.replace(regex, phonetic);
  }
  return result;
}

if (typeof window !== 'undefined') {
  window.ttsPronunciationMap = ttsPronunciationMap;
  window.normalizeStorePronunciation = normalizeStorePronunciation;
}

class NavigationEngine {
  constructor(mallData) {
    this.mallData = mallData;
    this.nodes = mallData.graph.nodes;
    this.adj = mallData.graph.adj;
    this.floors = mallData.floors;
    this.entrances = mallData.entrances;
    this.mPerUnit = mallData.meta?.mPerUnit || 0.48;
    this.ttsPronunciationMap = ttsPronunciationMap;
  }

  normalizeStorePronunciation(rawText) {
    return normalizeStorePronunciation(rawText);
  }

  _isEnglishMode() {
    if (typeof window === 'undefined') return false;
    const lang = window.currentLanguage || window.currentLang || document.documentElement?.lang || 'tr';
    return String(lang).toLowerCase().startsWith('en');
  }

  _getStoreOrEntranceNameByNode(nodeId) {
    if (!nodeId) return '';
    if (typeof window !== 'undefined' && window.selectedTargetStore && window.selectedTargetStore.nav_node === nodeId && window.selectedTargetStore.name) {
      return window.selectedTargetStore.name;
    }
    for (const fl of Object.values(this.floors || {})) {
      const found = (fl.stores || []).find(s => s.nav_node === nodeId);
      if (found && found.name) return found.name;
      const foundAm = (fl.amenities || []).find(a => a.nav_node === nodeId);
      if (foundAm && foundAm.name) return foundAm.name;
    }
    const topAm = (this.mallData?.amenities || []).find(a => a.nav_node === nodeId);
    if (topAm && topAm.name) return topAm.name;
    const ent = (this.entrances || []).find(e => e.nav_node === nodeId);
    if (ent && (ent.short_name || ent.name)) return ent.short_name || ent.name;
    return '';
  }

  _isAmenityTarget(nodeId, displayName = '') {
    if (typeof window !== 'undefined' && window.selectedTargetStore && (!nodeId || window.selectedTargetStore.nav_node === nodeId)) {
      if (typeof window.isServiceOrAmenityItem === 'function' && window.isServiceOrAmenityItem(window.selectedTargetStore)) {
        return true;
      }
    }
    const norm = String(displayName || '')
      .replace(/İ/g, 'i')
      .replace(/I/g, 'ı')
      .toLowerCase();
    if (!norm) return false;
    return /(saglik|sağlık|ilk yardim|ilk yardım|revir|mescit|bebek|wc|tuvalet|lavabo|danisma|danışma|atm|bankamatik|otopark|asansor|asansör|merdiven|acil cikis|acil çıkış|kiosk)/.test(norm);
  }

  _getAmenityLabelEn(name) {
    const norm = String(name || '').toLowerCase();
    if (norm.includes('wc') || norm.includes('tuvalet') || norm.includes('lavabo')) return 'Restroom';
    if (norm.includes('bebek')) return 'Baby Care Room';
    if (norm.includes('mescit')) return 'Prayer Room';
    if (norm.includes('danisma') || norm.includes('danışma') || norm.includes('info')) return 'Information Desk';
    if (norm.includes('atm') || norm.includes('bankamatik')) return 'ATM';
    if (norm.includes('saglik') || norm.includes('sağlık') || norm.includes('revir')) return 'Health & First Aid Room';
    if (norm.includes('otopark') || norm.includes('vale')) return 'Parking Area';
    if (norm.includes('asansor') || norm.includes('asansör')) return 'Elevator';
    return name || 'Service Point';
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
      const isEn = this._isEnglishMode();
      const targetName = this._getStoreOrEntranceNameByNode(targetNodeId);
      const sameNodeText = isEn
        ? (targetName ? `You have arrived at ${targetName}.` : 'You have arrived at your destination.')
        : 'Şu anda hedefin yanındasınız.';
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
          emoji: '',
          floor: nodeData.floor,
          text: sameNodeText,
          voiceText: sameNodeText
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
          if (nid.startsWith('c_4_wp_pool_')) return false;
          if (nid === 'c_4_m_700') return true;
          const nd = this.nodes[nid];
          if (nd && nd.floor === 4) {
            const dx = (nd.x - 700) / 72;
            const dy = (nd.y - 425) / 36;
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
        if (segLen < 1) continue;

        for (const s of floorStores) {
          if (excludeNavNodes.has(s.nav_node)) continue;

          const doorX = s.door_x !== undefined ? s.door_x : s.cx;
          const doorY = s.door_y !== undefined ? s.door_y : s.cy;
          const pDoor = this._pointToSegmentProjection(doorX, doorY, u.x, u.y, v.x, v.y);

          if (pDoor.dist <= maxDoorDist && pDoor.t >= 0.0 && pDoor.t <= 1.0) {
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

    // Önce koridor cephesindeki (kapısı koridora <= 30 birim mesafedeki) doğrudan komşu mağazaları bul
    const directMatches = collectMatches(30);
    if (directMatches.length > 0) {
      return directMatches;
    }
    // Doğrudan cephe mağazası yoksa yakın çevredeki (<= 48 birim) mağazaları döndür
    return collectMatches(48);
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
      const orderedNames = [];
      for (const s of stores) {
        if (!s || !s.id) continue;
        if (!enRouteStoreIdSet.has(s.id)) {
          enRouteStoreIdSet.add(s.id);
          enRouteStoreNames.push(s.name);
        }
        if (!orderedNames.includes(s.name)) {
          orderedNames.push(s.name);
        }
      }
      return orderedNames;
    };

    const formatPassingPhrase = (storeNames, walkMeters, isFinalStretch = false) => {
      const picked = storeNames.slice(0, 3);
      const prefix = isFinalStretch ? `Son ${walkMeters} m` : `${walkMeters} m`;
      if (picked.length === 3) {
        return `${picked[0]}, ${picked[1]} ve ${picked[2]} mağazalarını sırasıyla geçerek ${prefix} düz ilerleyin.`;
      } else if (picked.length === 2) {
        return `${picked[0]} ve ${picked[1]} mağazalarını sırasıyla geçerek ${prefix} düz ilerleyin.`;
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
    let pendingTurn = null; // { isRight: boolean, landmark: string|null, nodeIndex: number }

    const isEn = this._isEnglishMode();
    const targetDisplayName = this._getStoreOrEntranceNameByNode(targetNodeId);

    const buildSegmentInstruction = (startIdx, endIdx, walkMeters, isFinalStretch, upcomingTurn = null) => {
      const passedObjs = this._getPassingStoresForRange(pathNodes, startIdx, endIdx, excludeEndpoints);
      const passedNames = recordPassingStores(passedObjs);
      const picked = passedNames.slice(0, 3);

      let storeClause = '';
      if (picked.length === 3) {
        storeClause = `${picked[0]}, ${picked[1]} ve ${picked[2]} mağazalarını sırasıyla geçerek `;
      } else if (picked.length === 2) {
        storeClause = `${picked[0]} ve ${picked[1]} mağazalarını sırasıyla geçerek `;
      } else if (picked.length === 1) {
        storeClause = `${picked[0]} mağazasını geçerek `;
      }

      if (pendingTurn) {
        const dirWord = pendingTurn.isRight ? 'sağa' : 'sola';
        const dirCap = pendingTurn.isRight ? 'Sağa' : 'Sola';
        const turnPrefix = pendingTurn.landmark
          ? `${pendingTurn.landmark} hizasından ${dirWord} dönün`
          : `${dirCap} dönün`;

        const upcomingSuffix = upcomingTurn
          ? `, ardından ${upcomingTurn.landmark ? upcomingTurn.landmark + ' hizasından ' : ''}${upcomingTurn.isRight ? 'sağa' : 'sola'} dönün.`
          : '.';

        const trText = `${turnPrefix}; ${storeClause}${walkMeters} metre düz ilerleyin${upcomingSuffix}`;

        const dirEn = pendingTurn.isRight ? 'right' : 'left';
        const turnPrefixEn = pendingTurn.landmark
          ? `Turn ${dirEn} near ${pendingTurn.landmark}`
          : `Turn ${dirEn}`;
        const passClauseEn = picked.length > 0 ? ` past ${picked.join(', ')}` : '';
        const upcomingSuffixEn = upcomingTurn
          ? `, then turn ${upcomingTurn.isRight ? 'right' : 'left'}${upcomingTurn.landmark ? ' near ' + upcomingTurn.landmark : ''}.`
          : '.';
        const enText = `${turnPrefixEn}; walk straight for ${walkMeters} meters${passClauseEn}${upcomingSuffixEn}`;

        const text = isEn ? enText : trText;
        const allPassing = pendingTurn.landmark
          ? [pendingTurn.landmark, ...picked.filter(n => n !== pendingTurn.landmark)].slice(0, 3)
          : picked;

        const ins = {
          step: stepNum++,
          nodeIndex: pendingTurn.nodeIndex,
          type: pendingTurn.isRight ? 'turn_right' : 'turn_left',
          icon: pendingTurn.isRight ? 'corner-up-right' : 'corner-up-left',
          emoji: '',
          floor: currentFloor,
          meters: walkMeters,
          landmark: pendingTurn.landmark,
          passingStores: allPassing,
          text,
          voiceText: text
        };
        pendingTurn = null;
        return ins;
      }

      let trText = '';
      let enText = '';

      if (upcomingTurn) {
        const dirTr = upcomingTurn.isRight ? 'sağa' : 'sola';
        const nearTr = upcomingTurn.landmark ? `${upcomingTurn.landmark} hizasından ` : '';
        trText = `${storeClause}${walkMeters} metre düz ilerleyin, ardından ${nearTr}${dirTr} dönün.`;

        const dirEn = upcomingTurn.isRight ? 'right' : 'left';
        const nearEn = upcomingTurn.landmark ? ` near ${upcomingTurn.landmark}` : '';
        const passClauseEn = picked.length > 0 ? ` past ${picked.join(', ')}` : '';
        enText = `Walk straight for ${walkMeters} meters${passClauseEn}, then turn ${dirEn}${nearEn}.`;
      } else {
        const passClauseEn = picked.length > 0 ? ` past ${picked.join(', ')}` : '';
        if (isFinalStretch) {
          trText = `${storeClause}son ${walkMeters} metre düz ilerleyin.`;
          enText = `Walk straight for the final ${walkMeters} meters${passClauseEn}.`;
        } else {
          trText = `${storeClause}${walkMeters} metre düz ilerleyin.`;
          enText = `Walk straight for ${walkMeters} meters${passClauseEn}.`;
        }
      }

      trText = trText.charAt(0).toUpperCase() + trText.slice(1);
      const text = isEn ? enText : trText;

      return {
        step: stepNum++,
        nodeIndex: startIdx,
        type: upcomingTurn && walkMeters <= 18 ? (upcomingTurn.isRight ? 'turn_right' : 'turn_left') : 'straight',
        icon: upcomingTurn && walkMeters <= 18 ? (upcomingTurn.isRight ? 'corner-up-right' : 'corner-up-left') : 'arrow-up',
        emoji: '',
        floor: currentFloor,
        meters: walkMeters,
        passingStores: picked,
        text,
        voiceText: text
      };
    };

    for (let i = 0; i < pathNodes.length - 1; i++) {
      const u = pathNodes[i];
      const v = pathNodes[i + 1];

      // Kat Değişimi (Ardışık merdiven/asansör geçişlerini tek adımda konsolide et: örn. Z -> B1 -> B2 -> B3)
      if (u.floor !== v.floor) {
        if (accumulatedWalk > 5 || pendingTurn) {
          const walkMeters = Math.max(4, Math.round(accumulatedWalk * this.mPerUnit));
          instructions.push(buildSegmentInstruction(walkStartIndex, i, walkMeters, false, null));
          accumulatedWalk = 0;
        }

        const startFloor = u.floor;
        let finalFloor = v.floor;
        let endPortalNodeIdx = i + 1;
        let isElevator = v.edgeType === 'elevator' || v.portalKind === 'elevator';
        let consolidatedFloors = [startFloor, finalFloor];
        const finalTargetFloor = pathNodes[pathNodes.length - 1].floor;

        // İleriye bakarak ardışık kat geçişlerini (veya ara katlardaki merdiven sahanlığı bağlantısını) tek cümlede birleştir
        while (endPortalNodeIdx < pathNodes.length - 1) {
          let scanIdx = endPortalNodeIdx;
          let interFloorWalk = 0;
          let foundNextPortal = false;

          while (scanIdx < pathNodes.length - 1) {
            const a = pathNodes[scanIdx];
            const b = pathNodes[scanIdx + 1];
            if (a.floor !== b.floor) {
              foundNextPortal = true;
              break;
            }
            interFloorWalk += Math.hypot(b.x - a.x, b.y - a.y);
            if (a.floor === finalTargetFloor && interFloorWalk > 180) {
              break;
            }
            scanIdx++;
          }

          if (foundNextPortal) {
            const nextPortalTarget = pathNodes[scanIdx + 1];
            finalFloor = nextPortalTarget.floor;
            endPortalNodeIdx = scanIdx + 1;
            consolidatedFloors.push(finalFloor);
            if (nextPortalTarget.edgeType === 'elevator' || nextPortalTarget.portalKind === 'elevator') {
              isElevator = true;
            }
          } else {
            break;
          }
        }

        const portalText = isElevator ? 'Asansörü kullanarak' : 'Yürüyen merdivenleri kullanarak';
        const dirText = finalFloor > startFloor ? 'çıkın' : 'inin';
        const rawLabel = this._getFloorLabel(finalFloor);
        const baseFloor = rawLabel.replace(/\s*Kat$/i, '').trim();
        const trFcText = `${portalText} ${baseFloor} katına ${dirText}.`;
        const portalEn = isElevator ? 'elevator' : 'escalator';
        const targetFloorEn = this._getFloorLabelEn(finalFloor);
        const enFcText = `Take the ${portalEn} to ${targetFloorEn}.`;
        const fcText = isEn ? enFcText : trFcText;

        instructions.push({
          step: stepNum++,
          nodeIndex: i,
          endNodeIndex: endPortalNodeIdx,
          type: 'floor_change',
          icon: isElevator ? 'arrow-up-down' : 'layers',
          emoji: '',
          floor: finalFloor,
          fromFloor: startFloor,
          toFloor: finalFloor,
          consolidatedFloors,
          passingStores: [],
          text: fcText,
          voiceText: fcText
        });

        currentFloor = finalFloor;
        walkStartIndex = endPortalNodeIdx;
        pendingTurn = null;
        accumulatedWalk = 0;
        i = endPortalNodeIdx - 1;
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

        if (Math.abs(diff) >= 35) {
          const isRight = diff > 0;
          const nearbyLandmark = getNearbyStoreName(currentFloor, v.x, v.y);
          const upcomingTurn = { isRight, landmark: nearbyLandmark, nodeIndex: i + 1 };

          if (accumulatedWalk > 5 || pendingTurn) {
            const walkMeters = Math.max(4, Math.round(accumulatedWalk * this.mPerUnit));
            instructions.push(buildSegmentInstruction(walkStartIndex, i + 1, walkMeters, false, upcomingTurn));
            accumulatedWalk = 0;
          }

          pendingTurn = upcomingTurn;
          walkStartIndex = i + 1;
        }
      }
    }

    if (accumulatedWalk > 5 || pendingTurn) {
      const walkMeters = Math.max(4, Math.round(accumulatedWalk * this.mPerUnit));
      instructions.push(buildSegmentInstruction(walkStartIndex, pathNodes.length - 1, walkMeters, true, null));
    } else if (instructions.length === 0) {
      const startText = isEn
        ? `Continue straight toward your destination on ${this._getFloorLabelEn(currentFloor)}.`
        : `${this._getFloorLabel(currentFloor)} üzerinde hedefe doğru ilerleyin.`;
      instructions.push({
        step: stepNum++,
        nodeIndex: 0,
        type: 'straight',
        icon: 'arrow-up',
        emoji: '',
        floor: currentFloor,
        passingStores: [],
        text: startText,
        voiceText: startText
      });
    }

    const isAmenityDest = this._isAmenityTarget(targetNodeId, targetDisplayName);
    const cleanTargetName = String(targetDisplayName || '').trim();
    let arrivalShortText;
    let arrivalVoiceText;

    if (isAmenityDest) {
      const amName = cleanTargetName || (isEn ? 'Service Point' : 'Hizmet Noktası');
      const amNameEn = this._getAmenityLabelEn(cleanTargetName);
      arrivalShortText = isEn ? `You have arrived at ${amNameEn}.` : `${amName} noktasındasınız.`;
      arrivalVoiceText = arrivalShortText;
    } else {
      arrivalShortText = isEn
        ? (cleanTargetName ? `You have arrived at ${cleanTargetName}.` : 'You have arrived at your destination.')
        : (cleanTargetName ? `${cleanTargetName} önündesiniz.` : 'Hedefinize ulaştınız.');
      arrivalVoiceText = isEn
        ? (cleanTargetName ? `You have arrived at ${cleanTargetName}.` : 'You have arrived at your destination.')
        : (cleanTargetName
          ? `Hedefe ulaştınız! ${cleanTargetName} mağazası önündesiniz. Keyifli alışverişler dileriz.`
          : 'Hedefinize ulaştınız. Keyifli alışverişler dileriz.');
    }

    instructions.push({
      step: stepNum++,
      nodeIndex: pathNodes.length - 1,
      type: 'destination',
      icon: 'check-circle-2',
      emoji: '',
      floor: pathNodes[pathNodes.length - 1].floor,
      isAmenityDestination: isAmenityDest,
      passingStores: [],
      queueAfterPrevious: true,
      minQueueDelayMs: 450,
      text: arrivalShortText,
      voiceText: arrivalVoiceText
    });

    return {
      instructions,
      enRouteStoreIds: Array.from(enRouteStoreIdSet),
      enRouteStoreNames
    };
  }

  /**
   * Eğer speechSynthesis hala önceki cümleyi okuyorsa, hedefe varış anonsunu 400-500ms kuyruğa (queue) alır
   */
  queueArrivalSpeech(arrivalText, speakCallback, delayMs = 450) {
    const isEn = this._isEnglishMode();
    const cleanText = String(arrivalText || '');
    const waitMs = Math.max(400, Math.min(500, delayMs || 450));
    const isBusy = typeof window !== 'undefined' && (
      Boolean('speechSynthesis' in window && window.speechSynthesis && window.speechSynthesis.speaking) ||
      (typeof performance !== 'undefined' && performance.now() < (window.speechMainBusyUntil || 0))
    );
    if (!isBusy) {
      if (typeof speakCallback === 'function') speakCallback(cleanText);
      return null;
    }
    const pollSpeak = () => {
      const stillBusy = typeof window !== 'undefined' && (
        Boolean('speechSynthesis' in window && window.speechSynthesis && window.speechSynthesis.speaking) ||
        (typeof performance !== 'undefined' && performance.now() < (window.speechMainBusyUntil || 0))
      );
      if (stillBusy) {
        if (typeof window !== 'undefined') {
          window.queuedArrivalTimer = setTimeout(pollSpeak, waitMs);
        }
        return;
      }
      if (typeof speakCallback === 'function') speakCallback(cleanText);
    };
    const timerId = setTimeout(pollSpeak, waitMs);
    if (typeof window !== 'undefined') {
      window.queuedArrivalTimer = timerId;
    }
    return timerId;
  }

  /**
   * Canlı GPS yürüyüş modunda kullanıcının (x, y, floor) koordinatını aktif rotanın en yakın segmentine izdüşürür
   */
  projectPointOntoRoute(routeData, x, y, floor) {
    if (!routeData || !routeData.pathNodes || routeData.pathNodes.length < 2) {
      return null;
    }
    const nodes = routeData.pathNodes;
    let bestDist = Infinity;
    let bestSegIdx = 0;
    let bestT = 0;
    let bestX = nodes[0].x;
    let bestY = nodes[0].y;
    let bestHeading = 0;

    for (let i = 0; i < nodes.length - 1; i++) {
      const u = nodes[i];
      const v = nodes[i + 1];
      if (floor !== undefined && floor !== null && u.floor !== floor && v.floor !== floor) continue;
      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const lenSq = dx * dx + dy * dy;
      let t = 0;
      if (lenSq > 0.001) {
        t = Math.max(0, Math.min(1, ((x - u.x) * dx + (y - u.y) * dy) / lenSq));
      }
      const px = u.x + dx * t;
      const py = u.y + dy * t;
      const d = Math.hypot(x - px, y - py);
      if (d < bestDist) {
        bestDist = d;
        bestSegIdx = i;
        bestT = t;
        bestX = px;
        bestY = py;
        bestHeading = (Math.atan2(dy, dx) * 180) / Math.PI;
      }
    }

    const totalSegs = Math.max(1, nodes.length - 1);
    const progressPct = Math.min(100, Math.max(0, ((bestSegIdx + bestT) / totalSegs) * 100));
    const resolvedFloor = floor !== undefined && floor !== null ? floor : nodes[bestSegIdx].floor;
    return {
      segIndex: bestSegIdx,
      segProgress: bestT,
      progressPct,
      progressRatio: progressPct / 100,
      snappedX: bestX,
      snappedY: bestY,
      x: bestX,
      y: bestY,
      floor: resolvedFloor,
      headingDeg: bestHeading,
      heading: bestHeading,
      distanceFromRoute: bestDist
    };
  }

  _getFloorLabel(floorNum) {
    return this.floors[floorNum]?.label || `${floorNum}. Kat`;
  }

  _getFloorLabelEn(floorNum) {
    const map = {
      6: 'Floor 2',
      5: 'Floor 1',
      4: 'Ground Floor',
      3: 'Floor B1',
      2: 'Floor B2',
      1: 'Floor B3'
    };
    return map[Number(floorNum)] || `Floor ${floorNum}`;
  }
}



