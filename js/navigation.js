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
   * @returns {Object} { totalDistance, estimatedMinutes, pathNodes, segmentsByFloor, instructions, mode, fallbackUsed }
   */
  findRoute(startNodeId, targetNodeId, mode = 'escalator') {
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
        mode
      };
    }

    // 1. Seçilen mod ile dene
    let result = this._runDijkstra(startNodeId, targetNodeId, mode);

    // 2. Eğer tekil modla rota bulunamazsa kullanıcıyı yolda bırakmamak için otomatik olarak 'both' fallback
    if (!result && mode !== 'both') {
      result = this._runDijkstra(startNodeId, targetNodeId, 'both');
      if (result) {
        result.fallbackUsed = true;
      }
    }

    return result;
  }

  _runDijkstra(startNodeId, targetNodeId, mode) {
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

    while (!pq.isEmpty()) {
      const { val: u, priority: currentDist } = pq.dequeue();

      if (u === targetNodeId) {
        return this._buildRouteResult(startNodeId, targetNodeId, prev, currentDist, mode);
      }

      if (currentDist > dist[u]) continue;

      const neighbors = this.adj[u] || [];
      for (const edge of neighbors) {
        const v = edge.to;
        const edgeType = edge.type || 'walk';

        // Mod filtreleme: Dikey kenarlarda yürüyen merdiven vs asansör kuralı
        if (edgeType !== 'walk' && !allowedTransfers.includes(edgeType)) {
          continue;
        }

        const alt = currentDist + edge.dist;
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

    const pathNodes = pathNodeIds.map((nid, idx) => {
      const nodeData = this.nodes[nid];
      const prevEdge = idx > 0 ? prev[nid]?.edge : null;
      return {
        id: nid,
        floor: nodeData.floor,
        x: nodeData.x,
        y: nodeData.y,
        edgeType: prevEdge ? prevEdge.type : 'start',
        portalKind: prevEdge ? prevEdge.portalKind : null
      };
    });

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
    const totalMeters = Math.round(totalDist * this.mPerUnit);
    const estimatedMinutes = Math.max(1, Math.ceil(totalMeters / 60)); // ~1 m/s = 60 m/dk

    // Doğal dil Türkçe yönlendirme talimatları
    const instructions = this._generateInstructions(pathNodes);

    return {
      totalDistance: totalMeters,
      totalUnits: Math.round(totalDist),
      estimatedMinutes,
      pathNodes,
      path: pathNodes,
      segments,
      segmentsByFloor,
      instructions,
      mode
    };
  }

  _generateInstructions(pathNodes) {
    const instructions = [];
    if (!pathNodes || pathNodes.length === 0) return instructions;

    let stepNum = 1;
    let currentFloor = pathNodes[0].floor;
    let accumulatedWalk = 0;

    instructions.push({
      step: stepNum++,
      type: 'start',
      icon: 'map-pin',
      floor: currentFloor,
      text: `${this._getFloorLabel(currentFloor)} üzerinde harekete başlayın.`
    });

    for (let i = 0; i < pathNodes.length - 1; i++) {
      const u = pathNodes[i];
      const v = pathNodes[i + 1];

      // Kat Değişimi
      if (u.floor !== v.floor) {
        if (accumulatedWalk > 5) {
          instructions.push({
            step: stepNum++,
            type: 'straight',
            icon: 'arrow-up',
            floor: u.floor,
            meters: Math.round(accumulatedWalk * this.mPerUnit),
            text: `Koridorda ${Math.round(accumulatedWalk * this.mPerUnit)} m düz ilerleyin.`
          });
          accumulatedWalk = 0;
        }

        const isElevator = v.edgeType === 'elevator' || v.portalKind === 'elevator';
        const portalText = isElevator ? 'Asansöre binerek' : 'Yürüyen merdiveni kullanarak';
        const dirText = v.floor > u.floor ? 'çıkın' : 'inin';

        instructions.push({
          step: stepNum++,
          type: 'floor_change',
          icon: isElevator ? 'arrow-up-down' : 'layers',
          floor: v.floor,
          fromFloor: u.floor,
          toFloor: v.floor,
          text: `${portalText} ${this._getFloorLabel(v.floor)} katına ${dirText}.`
        });

        currentFloor = v.floor;
        continue;
      }

      // Aynı kat içi yürüyüş
      const stepDist = Math.hypot(v.x - u.x, v.y - u.y);
      accumulatedWalk += stepDist;

      // Viraj / Dönüş Kontrolü
      if (i < pathNodes.length - 2 && pathNodes[i + 2].floor === currentFloor) {
        const next = pathNodes[i + 2];
        const angle1 = Math.atan2(v.y - u.y, v.x - u.x);
        const angle2 = Math.atan2(next.y - v.y, next.x - v.x);
        let diff = (angle2 - angle1) * (180 / Math.PI);
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;

        if (Math.abs(diff) >= 40) {
          if (accumulatedWalk > 5) {
            instructions.push({
              step: stepNum++,
              type: 'straight',
              icon: 'arrow-up',
              floor: currentFloor,
              meters: Math.round(accumulatedWalk * this.mPerUnit),
              text: `Koridorda ${Math.round(accumulatedWalk * this.mPerUnit)} m düz ilerleyin.`
            });
            accumulatedWalk = 0;
          }

          const isRight = diff > 0;
          instructions.push({
            step: stepNum++,
            type: isRight ? 'turn_right' : 'turn_left',
            icon: isRight ? 'corner-up-right' : 'corner-up-left',
            floor: currentFloor,
            text: isRight ? 'Sağa dönün.' : 'Sola dönün.'
          });
        }
      }
    }

    if (accumulatedWalk > 5) {
      instructions.push({
        step: stepNum++,
        type: 'straight',
        icon: 'arrow-up',
        floor: currentFloor,
        meters: Math.round(accumulatedWalk * this.mPerUnit),
        text: `Son ${Math.round(accumulatedWalk * this.mPerUnit)} m düz ilerleyin.`
      });
    }

    instructions.push({
      step: stepNum++,
      type: 'destination',
      icon: 'check-circle-2',
      floor: pathNodes[pathNodes.length - 1].floor,
      text: 'Hedefinize ulaştınız.'
    });

    return instructions;
  }

  _getFloorLabel(floorNum) {
    return this.floors[floorNum]?.label || `${floorNum}. Kat`;
  }
}
