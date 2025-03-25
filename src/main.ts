// pixi.js를 CDN으로 로드하여 사용
// TypeScript에서 전역 PIXI 객체 사용을 위한 타입 선언
declare const PIXI: any;
declare const io: any;

// 연결된 사용자들의 정보를 저장할 배열
interface OrbitalUser {
    id: string;
    orbit: {alpha: number, beta: number, gamma: number};
    distance: number;
    angle: number;
    speed: number;
    orbitGraphics: any; // PIXI.Graphics[]
    color: number;
}

const connectedUsers: OrbitalUser[] = [];

// 다중 블러를 사용한 Glow 효과 생성을 위한 클래스
class GlowFilter {
    private container: any;
    private layers: any[] = [];
    private baseObject: any;
    private layerCount: number;
    
    constructor(container: any, baseObject: any, color: number, layerCount: number = 3) {
        this.container = container;
        this.baseObject = baseObject;
        this.layerCount = layerCount;
        
        // 원본 객체 저장
        this.container.addChild(this.baseObject);
        
        // 블러 레이어 생성
        for (let i = 0; i < layerCount; i++) {
            const layer = this.baseObject.clone();
            layer.alpha = 0.3 - (i * 0.05); // 바깥쪽 레이어일수록 투명도 감소
            
            // 각 레이어마다 다른 블러 강도 적용
            const blurFilter = new PIXI.BlurFilter();
            blurFilter.blur = 5 + (i * 5); // 바깥쪽 레이어일수록 블러 강도 증가
            blurFilter.quality = 1; // 성능 최적화를 위해 품질 조정
            
            layer.filters = [blurFilter];
            
            // 블러 레이어를 원본 객체 뒤에 추가
            this.layers.push(layer);
            this.container.addChildAt(layer, 0);
        }
    }
    
    // 위치 업데이트
    updatePosition(x: number, y: number) {
        this.baseObject.position.set(x, y);
        
        for (const layer of this.layers) {
            layer.position.set(x, y);
        }
    }
    
    // 색상 업데이트
    updateColor(color: number) {
        if (this.baseObject.tint !== undefined) {
            this.baseObject.tint = color;
            
            for (const layer of this.layers) {
                layer.tint = color;
            }
        }
    }
    
    // 크기 업데이트
    updateScale(scale: number) {
        this.baseObject.scale.set(scale, scale);
        
        for (const layer of this.layers) {
            layer.scale.set(scale, scale);
        }
    }
    
    // 가시성 업데이트
    updateVisibility(visible: boolean) {
        this.baseObject.visible = visible;
        
        for (const layer of this.layers) {
            layer.visible = visible;
        }
    }
    
    // 필터 제거 및 정리
    destroy() {
        for (const layer of this.layers) {
            this.container.removeChild(layer);
            layer.destroy();
        }
        
        this.container.removeChild(this.baseObject);
        this.baseObject.destroy();
        
        this.layers = [];
    }
}

async function initApp() {
    const app = new PIXI.Application();

    await app.init({
        background: "#000000",
        resizeTo: window,
        antialias: true,
    });

    document.body.appendChild(app.canvas);

    // 메인 컨테이너 생성
    const container = new PIXI.Container();
    app.stage.addChild(container);
    container.position.set(app.screen.width / 2, app.screen.height / 2);
    
    // 궤도 오브젝트를 위한 컨테이너
    const orbitContainer = new PIXI.Container();
    container.addChild(orbitContainer);

    interface Camera {
        x: number;
        y: number;
        z: number;
        fov: number;
        aspect: number;
        yaw: number;
        pitch: number;
    }

    let camera: Camera = {
        x: 0,
        y: 0,
        z: -250,
        fov: 60,
        aspect: app.screen.width / app.screen.height,
        yaw: 0,
        pitch: 0,
    }

    interface Cube {
        x: number;
        y: number;
        z: number;
        size: number;
        vertexes: number;
        rotation: {
            x: number;
            y: number;
            z: number;
        };
        colors: number[]
    }

    let centerCube: Cube = {
        x: 0,
        y: 0,
        z: 0,
        size: 120,
        vertexes: 3,
        rotation: {
            x: 0,
            y: 0,
            z: 0,
        },
        colors: [0x40efef, 0x9b8d7f, 0xdf43d0]
    }

    const socket = io();

    socket.on('connect', () => {
        console.log('Server connected!');
        socket.emit('setClientType', 'display');
    });

    socket.on('userConnected', (userId: string) => {
        console.log('새 사용자 연결됨:', userId);
        
        // 색상 선택
        const userColors = [0xFF4500, 0x00BFFF, 0xFF1493, 0xFFD700, 0x32CD32, 0xDA70D6, 0x20B2AA];
        const colorIndex = connectedUsers.length % userColors.length;
        const color = userColors[colorIndex];
        
        // 궤도 그래픽 생성
        const orbitBase = new PIXI.Graphics();
        orbitBase.beginFill(color);
        orbitBase.drawCircle(0, 0, 5);
        orbitBase.endFill();
        
        // 궤도 원을 위한 컨테이너
        const orbitCircleContainer = new PIXI.Container();
        orbitContainer.addChild(orbitCircleContainer);
        
        // Glow 효과 적용
        const orbitGlow = new GlowFilter(orbitCircleContainer, orbitBase, color, 3);
        
        // 사용자 정보 저장
        connectedUsers.push({
            id: userId,
            orbit: {alpha: 0, beta: 0, gamma: 0},
            distance: 100 + Math.random() * 50,
            angle: Math.random() * Math.PI * 2,
            speed: 0.01,
            orbitGraphics: orbitGlow,
            color: color
        });
    });

    socket.on('userDisconnected', (userId: string) => {
        const index = connectedUsers.findIndex(user => user.id === userId);
        if (index !== -1) {
            // 해당 사용자의 궤도 객체 제거
            if (connectedUsers[index].orbitGraphics) {
                connectedUsers[index].orbitGraphics.destroy();
            }
            connectedUsers.splice(index, 1);
        }
    });

    // 자이로스코프 데이터 수신 처리
    socket.on('gyroscopeData', (data: { userId: string, alpha: number, beta: number, gamma: number }) => {
        const user = connectedUsers.find(u => u.id === data.userId);
        if (user) {
            // 자이로스코프 데이터 저장
            user.orbit.alpha = data.alpha;
            user.orbit.beta = data.beta;
            user.orbit.gamma = data.gamma;
            
            // 베타값(기울기)에 따른 속도 조정
            user.speed = 0.01 + Math.abs(data.beta / 1000);
            
            // 감마값(좌우 회전)에 따른 거리 조정
            user.distance = Math.max(80, Math.min(200, 100 + data.gamma));
            
            // 큐브 회전에 약간의 영향을 줌
            centerCube.rotation.x += data.beta / 10000;
            centerCube.rotation.y += data.gamma / 10000;
        }
    });

    const cubeGraphics = new PIXI.Graphics();
    container.addChild(cubeGraphics);
    
    // 큐브 glow 효과를 위한 레이어 생성
    const cubeLayers: PIXI.Graphics[] = [];
    const layerCount = 3;
    
    for (let i = 0; i < layerCount; i++) {
        const cubeLayer = new PIXI.Graphics();
        cubeLayer.alpha = 0.2 - (i * 0.03);
        
        const blurFilter = new PIXI.BlurFilter(i * 5);
        
        cubeLayer.filters = [blurFilter];
        container.addChildAt(cubeLayer, 0);
        cubeLayers.push(cubeLayer);
    }

    // 트레일 효과를 위한 배열
    const trails: {graphics: PIXI.Graphics, life: number}[] = [];
    const MAX_TRAILS = 100; // 최대 트레일 개수 (성능 최적화)

    // 애니메이션 루프
    app.ticker.add((ticker: any) => {
        // fps 조절 (성능 최적화)
        if (ticker.deltaTime > 2) {
            // 너무 높은 델타타임(낮은 FPS)일 경우 적절히 조절
            ticker.deltaTime = 2;
        }
        
        // 정육면체 회전
        centerCube.rotation.x += 0.01 * ticker.deltaTime;
        centerCube.rotation.y += 0.01 * ticker.deltaTime;
        centerCube.rotation.z += 0.01 * ticker.deltaTime;
        
        // 큐브 그리기
        drawCube(centerCube, cubeGraphics, camera);
        
        // 블러 레이어에도 같은 큐브 그리기
        for (const layer of cubeLayers) {
            layer.clear();
            drawCube(centerCube, layer, camera);
        }
        
        // 사용자 궤도 업데이트
        updateOrbits(ticker.deltaTime);
        
        // 트레일 업데이트
        updateTrails(ticker.deltaTime);
    });
    
    // 트레일 생성 함수
    function createTrail(x: number, y: number, color: number, size: number = 2) {
        if (trails.length >= MAX_TRAILS) {
            // 가장 오래된 트레일 제거
            const oldestTrail = trails.shift();
            if (oldestTrail) {
                container.removeChild(oldestTrail.graphics);
                oldestTrail.graphics.destroy();
            }
        }
        
        const trail = new PIXI.Graphics();
        trail.beginFill(color, 0.5);
        trail.drawCircle(0, 0, size);
        trail.endFill();
        trail.position.set(x, y);
        container.addChildAt(trail, container.children.indexOf(orbitContainer));
        
        trails.push({
            graphics: trail,
            life: 2 // 2초 수명
        });
    }
    
    // 트레일 업데이트 함수
    function updateTrails(deltaTime: number) {
        for (let i = trails.length - 1; i >= 0; i--) {
            const trail = trails[i];
            trail.life -= deltaTime / 60; // 60fps 기준으로 감소
            
            // 수명에 따른 투명도 조정
            trail.graphics.alpha = trail.life / 2;
            
            // 수명이 다한 트레일 제거
            if (trail.life <= 0) {
                container.removeChild(trail.graphics);
                trail.graphics.destroy();
                trails.splice(i, 1);
            }
        }
    }

    // 궤도 업데이트 함수
    function updateOrbits(deltaTime: number) {
        for (const user of connectedUsers) {
            // 각도 업데이트
            user.angle += user.speed * deltaTime;
            
            // 궤도 위치 계산 (3D 효과를 위한 추가 계산)
            const angleOffset = user.orbit.alpha * (Math.PI / 180) * 0.1;
            const x = Math.cos(user.angle + angleOffset) * user.distance;
            const y = Math.sin(user.angle + angleOffset) * user.distance;
            
            // 자이로스코프에 따른 z축 변형 (시각 효과만)
            const scale = 1 + (Math.sin(user.orbit.beta * (Math.PI / 180) * 0.1) * 0.2);
            
            // 위치 및 크기 업데이트
            user.orbitGraphics.updatePosition(x, y);
            user.orbitGraphics.updateScale(scale);
            
            // 트레일 생성 (15%의 확률로)
            if (Math.random() < 0.15) {
                createTrail(x, y, user.color, 2 * scale);
            }
        }
    }

    // 정육면체 그리기 함수
    function drawCube(box: Cube, graphics: any, camera: Camera) {
        graphics.clear();
        // 큐브의 꼭지점 계산
        const vertices: { x: number, y: number, z: number }[] = [];
        const size = box.size;
        
        // 정육면체의 기본 꼭지점 좌표 계산
        for (let x = -1; x <= 1; x += 2) {
            for (let y = -1; y <= 1; y += 2) {
                for (let z = -1; z <= 1; z += 2) {
                    vertices.push({
                        x: box.x + (x * size / 2),
                        y: box.y + (y * size / 2),
                        z: box.z + (z * size / 2)
                    });
                }
            }
        }
        
        // 세분화된 꼭지점 생성
        const detailedVertices: { x: number, y: number, z: number }[] = [];
        const vertexCount = box.vertexes; // 한 모서리당 정점 수
        
        // 각 모서리를 세분화
        const edges = [
            [0, 1], [1, 3], [3, 2], [2, 0], // 앞면
            [4, 5], [5, 7], [7, 6], [6, 4], // 뒷면
            [0, 4], [1, 5], [2, 6], [3, 7]  // 연결선
        ];
        
        // 각 모서리를 세분화하여 정점 추가
        edges.forEach(([startIdx, endIdx]) => {
            const start = vertices[startIdx];
            const end = vertices[endIdx];
            
            // 모서리의 시작점 추가
            detailedVertices.push({
                x: start.x,
                y: start.y,
                z: start.z
            });
            
            // 중간 정점 추가 (vertexCount가 2 이상일 때)
            for (let i = 1; i < vertexCount - 1; i++) {
                const t = i / (vertexCount - 1);
                detailedVertices.push({
                    x: start.x + (end.x - start.x) * t,
                    y: start.y + (end.y - start.y) * t,
                    z: start.z + (end.z - start.z) * t
                });
            }
            
            // 모서리의 끝점 추가
            detailedVertices.push({
                x: end.x,
                y: end.y,
                z: end.z
            });
        });
        
        // 회전 적용
        const rotatedVertices = detailedVertices.map(v => {
            // X축 회전
            let y1 = v.y * Math.cos(box.rotation.x) - v.z * Math.sin(box.rotation.x);
            let z1 = v.y * Math.sin(box.rotation.x) + v.z * Math.cos(box.rotation.x);
            
            // Y축 회전
            let x2 = v.x * Math.cos(box.rotation.y) + z1 * Math.sin(box.rotation.y);
            let z2 = -v.x * Math.sin(box.rotation.y) + z1 * Math.cos(box.rotation.y);
            
            // Z축 회전
            let x3 = x2 * Math.cos(box.rotation.z) - y1 * Math.sin(box.rotation.z);
            let y3 = x2 * Math.sin(box.rotation.z) + y1 * Math.cos(box.rotation.z);
            
            return { x: x3, y: y3, z: z2 };
        });
        
        // 3D -> 2D 투영
        const projectedVertices = rotatedVertices.map(v => {
            // 카메라 상대 좌표로 변환
            const dx = v.x - camera.x;
            const dy = v.y - camera.y;
            const dz = v.z - camera.z;
            
            // 원근 투영 계산
            const fovRad = camera.fov * (Math.PI / 180);
            const scale = 1 / Math.tan(fovRad / 2);
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // Z값이 0이면 무한대로 나누는 것을 방지
            if (dz === 0) return { x: 0, y: 0, distance: distance, visible: false };
            
            // 투영 계산
            const projectedX = (dx / dz) * scale;
            const projectedY = (dy / dz) * scale;
            
            // 카메라 뒤에 있는 점은 보이지 않음
            const visible = dz > 0;
            
            return { x: projectedX * 100, y: projectedY * 100, distance: distance, visible };
        });
        
        const maxY = Math.max(...projectedVertices.map(v => v.y));
        const minY = Math.min(...projectedVertices.map(v => v.y));
        const rangeY = maxY - minY;
        
        // 꼭지점 그리기 - 성능 최적화를 위해 한 번에 그리기
        projectedVertices.forEach(vertex => {
            if (!vertex.visible) return;
            
            // 거리에 따른 원 크기 계산 (멀수록 작게)
            const circleSize = Math.max(1, 5 - (vertex.distance / 100));
            
            // vertex.y 값에 따라 색상 인덱스 계산
            const normalizedY = (vertex.y - minY) / (rangeY || 1);  // 0 나누기 방지
            const colorIndex = Math.min(Math.floor(normalizedY * (box.colors.length-1)), box.colors.length - 1);

            // 색상 블렌딩 계산
            let color;
            if (colorIndex < box.colors.length - 1) {
                // 두 색상 사이의 정확한 위치 계산
                const colorPosition = normalizedY * (box.colors.length - 1);
                const lowerColorIndex = Math.floor(colorPosition);
                const upperColorIndex = Math.ceil(colorPosition);
                const blendFactor = colorPosition - lowerColorIndex;
                
                // 두 색상 추출
                const lowerColor = box.colors[lowerColorIndex];
                const upperColor = box.colors[upperColorIndex];
                
                // RGB 컴포넌트 추출
                const lowerR = (lowerColor >> 16) & 0xFF;
                const lowerG = (lowerColor >> 8) & 0xFF;
                const lowerB = lowerColor & 0xFF;
                
                const upperR = (upperColor >> 16) & 0xFF;
                const upperG = (upperColor >> 8) & 0xFF;
                const upperB = upperColor & 0xFF;
                
                // 색상 블렌딩
                const r = Math.round(lowerR + (upperR - lowerR) * blendFactor);
                const g = Math.round(lowerG + (upperG - lowerG) * blendFactor);
                const b = Math.round(lowerB + (upperB - lowerB) * blendFactor);
                
                // 최종 색상 생성
                color = (r << 16) | (g << 8) | b;
            } else {
                // 마지막 색상 사용
                color = box.colors[colorIndex];
            }
            
            graphics.beginFill(color);
            graphics.drawCircle(vertex.x, vertex.y, circleSize);
            graphics.endFill();
        });
    }

    window.addEventListener('resize', () => {
        container.position.set(app.screen.width / 2, app.screen.height / 2);
        camera.aspect = app.screen.width / app.screen.height;
    });
    
    // 메모리 최적화를 위한 정리 함수
    function cleanup() {
        // 트레일 정리
        for (const trail of trails) {
            container.removeChild(trail.graphics);
            trail.graphics.destroy();
        }
        trails.length = 0;
        
        // 사용자 오브젝트 정리
        for (const user of connectedUsers) {
            if (user.orbitGraphics) {
                user.orbitGraphics.destroy();
            }
        }
        connectedUsers.length = 0;
        
        // 블러 레이어 정리
        for (const layer of cubeLayers) {
            container.removeChild(layer);
            layer.destroy();
        }
        cubeLayers.length = 0;
    }
    
    // 창이 닫힐 때 정리
    window.addEventListener('beforeunload', cleanup);
}

// 애플리케이션 시작
initApp();
