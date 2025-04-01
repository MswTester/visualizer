// pixi.js를 CDN으로 로드하여 사용
// TypeScript에서 전역 PIXI 객체 사용을 위한 타입 선언
declare const PIXI: any;
declare const io: any;

interface Camera {
    x: number;
    y: number;
    z: number;
    fov: number;
    aspect: number;
    yaw: number;
    pitch: number;
}


interface Sphere {
    x: number;
    y: number;
    z: number;
    radius: number;
    segments: number;
    rotation: {
        x: number;
        y: number;
        z: number;
    };
    colors: number[];
    points: {x: number, y: number, z: number}[];
}

// 연결된 사용자들의 정보를 저장할 배열
interface OrbitalUser {
    id: string;
    orbit: {alpha: number, beta: number, gamma: number};
    distance: number;
    angle: number;
    speed: number;
    orbitGraphics: any; // PIXI.Graphics[]
    color: number;
    // 3D 구체 관련 속성 추가
    orbitSphere: Sphere;
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
            blurFilter.blur = 3 + (i * 3); // 바깥쪽 레이어일수록 블러 강도 증가
            blurFilter.quality = 4; // 성능 최적화를 위해 품질 조정
            
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

    let camera: Camera = {
        x: 0,
        y: 0,
        z: -250,
        fov: 60,
        aspect: app.screen.width / app.screen.height,
        yaw: 0,
        pitch: 0,
    }

    let centerSphere: Sphere = {
        x: 0,
        y: 0,
        z: 0,
        radius: 120,
        segments: 15,
        rotation: {
            x: 0,
            y: 0,
            z: 0,
        },
        colors: [0x40efef, 0x9b8d7f, 0xdf43d0],
        points: []
    }

    // 마우스 인터랙션을 위한 변수들
    let mouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    let isPC = !('ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    // 플랫폼 체크 및 이벤트 리스너 설정
    if (isPC) {
        console.log('PC 환경 감지: 마우스 컨트롤 활성화');
        
        // 마우스 이벤트 리스너
        app.canvas.addEventListener('mousedown', (e: MouseEvent) => {
            mouseDown = true;
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        app.canvas.addEventListener('mouseup', () => {
            mouseDown = false;
        });
        
        app.canvas.addEventListener('mousemove', (e: MouseEvent) => {
            if (mouseDown) {
                const deltaX = e.clientX - mouseX;
                const deltaY = e.clientY - mouseY;
                
                centerSphere.rotation.y += deltaX * 0.01;
                centerSphere.rotation.x += deltaY * 0.01;
                
                mouseX = e.clientX;
                mouseY = e.clientY;
            }
        });
        
        // 마우스 휠 이벤트로 줌 인/아웃
        app.canvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            camera.z += e.deltaY * 0.1;
            // 너무 가깝거나 멀어지지 않도록 제한
            camera.z = Math.max(-500, Math.min(-100, camera.z));
        });
    } else {
        console.log('모바일 환경 감지: 터치스크린 컨트롤 활성화');
        
        // 터치 이벤트 리스너 (모바일에서 테스트용)
        app.canvas.addEventListener('touchstart', (e: TouchEvent) => {
            if (e.touches.length === 1) {
                mouseDown = true;
                mouseX = e.touches[0].clientX;
                mouseY = e.touches[0].clientY;
            }
        });
        
        app.canvas.addEventListener('touchend', () => {
            mouseDown = false;
        });
        
        app.canvas.addEventListener('touchmove', (e: TouchEvent) => {
            if (mouseDown && e.touches.length === 1) {
                const deltaX = e.touches[0].clientX - mouseX;
                const deltaY = e.touches[0].clientY - mouseY;
                
                centerSphere.rotation.y += deltaX * 0.01;
                centerSphere.rotation.x += deltaY * 0.01;
                
                mouseX = e.touches[0].clientX;
                mouseY = e.touches[0].clientY;
            }
        });
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
        
        // 새로운 방식: 궤도 객체도 3D 구체로 생성
        const userSphereContainer = new PIXI.Container();
        const userGraphics = new PIXI.Graphics();
        
        // 기본 원 대신 빈 그래픽스 객체로 시작 (실제 렌더링은 drawUserSphere 함수에서 처리)
        userGraphics.beginFill(color);
        userGraphics.drawCircle(0, 0, 1); // 임시 원 (크기는 나중에 업데이트됨)
        userGraphics.endFill();
        
        // 궤도 원을 위한 컨테이너
        orbitContainer.addChild(userSphereContainer);
        
        // Glow 효과 적용
        const orbitGlow = new GlowFilter(userSphereContainer, userGraphics, color, 3);
        
        // 사용자 정보 저장 - 이제 3D 구체 정보 포함
        connectedUsers.push({
            id: userId,
            orbit: {alpha: 0, beta: 0, gamma: 0},
            distance: 20 + Math.random() * 10,
            angle: Math.random() * Math.PI * 2,
            speed: 0.01,
            orbitGraphics: orbitGlow,
            color: color,
            // 3D 구체 속성 추가 - 크기 증가
            orbitSphere: {
                x: 0,
                y: 0,
                z: 0,
                radius: 25, // 10에서 25로 증가
                segments: 12, // 8에서 12로 증가하여 더 부드럽게
                rotation: { x: 0, y: 0, z: 0 },
                colors: [color],
                points: []
            }
        });
        
        // 처음 연결된 사용자라면 포인트 초기화
        initUserSpherePoints(connectedUsers[connectedUsers.length - 1]);
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
            
            // 회전 값 설정 - 각 유저의 구체가 자이로스코프 방향에 맞게 회전
            user.orbitSphere.rotation.x = data.beta * 0.02;
            user.orbitSphere.rotation.y = data.gamma * 0.02;
            user.orbitSphere.rotation.z = data.alpha * 0.02;
            
            // 베타값에 따른 거리 조정만 유지
            user.distance = Math.max(20, Math.min(80, 50));
        }
    });

    const sphereGraphics = new PIXI.Graphics();
    container.addChild(sphereGraphics);
    
    // 구체 glow 효과를 위한 레이어 생성
    const sphereLayers: any[] = [];
    const layerCount = 4;
    
    for (let i = 0; i < layerCount; i++) {
        const sphereLayer = new PIXI.Graphics();
        sphereLayer.alpha = 0.2 - (i * 0.03);
        
        const blurFilter = new PIXI.BlurFilter(i * 2);
        
        sphereLayer.filters = [blurFilter];
        container.addChildAt(sphereLayer, 0);
        sphereLayers.push(sphereLayer);
    }

    // 트레일 효과를 위한 배열 및 타입 정의 수정
    const trails: {
        graphics: any, 
        life: number, 
        startPos: {x: number, y: number},
        endPos: {x: number, y: number},
        controlPoints: {x: number, y: number}[],
        color: number,
        size: number
    }[] = [];
    const MAX_TRAILS = 100; // 최대 트레일 개수 (성능 최적화)

    // 애니메이션 루프
    app.ticker.add((ticker: any) => {
        // fps 조절 (성능 최적화)
        if (ticker.deltaTime > 2) {
            // 너무 높은 델타타임(낮은 FPS)일 경우 적절히 조절
            ticker.deltaTime = 2;
        }
        
        // 구체 자동 회전 (마우스 인터랙션이 없을 때만)
        if (!mouseDown) {
            // 모바일 연결과 상관없이 항상 회전하도록 수정
            centerSphere.rotation.x += 0.005 * ticker.deltaTime;
            centerSphere.rotation.y += 0.01 * ticker.deltaTime;
            centerSphere.rotation.z += 0.003 * ticker.deltaTime;
        }
        
        // 구체 그리기
        drawSphere(centerSphere, sphereGraphics, camera);
        
        // 블러 레이어에도 같은 구체 그리기
        for (const layer of sphereLayers) {
            layer.clear();
            drawSphere(centerSphere, layer, camera);
        }
        
        // 사용자 궤도 업데이트
        updateOrbits(ticker.deltaTime);
        
        // 트레일 업데이트
        updateTrails(ticker.deltaTime);
    });
    
    // 사용자 구체의 포인트 초기화 함수
    function initUserSpherePoints(user: OrbitalUser) {
        const radius = user.orbitSphere.radius;
        const segments = user.orbitSphere.segments;
        const points: {x: number, y: number, z: number}[] = [];
        
        // 피보나치 분포로 균일한 구체 포인트 생성
        const numPoints = segments * segments;
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        
        for (let i = 0; i < numPoints; i++) {
            const theta = 2 * Math.PI * i / goldenRatio;
            const phi = Math.acos(1 - 2 * (i + 0.5) / numPoints);
            
            points.push({
                x: radius * Math.cos(theta) * Math.sin(phi),
                y: radius * Math.sin(theta) * Math.sin(phi),
                z: radius * Math.cos(phi)
            });
        }
        
        user.orbitSphere.points = points;
    }
    
    // 사용자 구체 그리기 함수
    function drawUserSphere(user: OrbitalUser, graphics: any, x: number, y: number, z: number, camera: Camera) {
        graphics.clear();
        
        if (!user.orbitSphere.points.length) {
            initUserSpherePoints(user);
        }
        
        // 3D 회전과 카메라 변환 적용
        const rotatedPoints = user.orbitSphere.points.map(p => {
            // X축 회전
            let y1 = p.y * Math.cos(user.orbitSphere.rotation.x) - p.z * Math.sin(user.orbitSphere.rotation.x);
            let z1 = p.y * Math.sin(user.orbitSphere.rotation.x) + p.z * Math.cos(user.orbitSphere.rotation.x);
            
            // Y축 회전
            let x2 = p.x * Math.cos(user.orbitSphere.rotation.y) + z1 * Math.sin(user.orbitSphere.rotation.y);
            let z2 = -p.x * Math.sin(user.orbitSphere.rotation.y) + z1 * Math.cos(user.orbitSphere.rotation.y);
            
            // Z축 회전
            let x3 = x2 * Math.cos(user.orbitSphere.rotation.z) - y1 * Math.sin(user.orbitSphere.rotation.z);
            let y3 = x2 * Math.sin(user.orbitSphere.rotation.z) + y1 * Math.cos(user.orbitSphere.rotation.z);
            
            // 위치 오프셋 적용 (궤도 위치)
            return { x: x3 + x, y: y3 + y, z: z2 + z };
        });
        
        // 3D -> 2D 투영
        const projectedPoints = rotatedPoints.map(p => {
            // 카메라 상대 좌표로 변환
            const dx = p.x - camera.x;
            const dy = p.y - camera.y;
            const dz = p.z - camera.z;
            
            // 원근 투영 계산
            const fovRad = camera.fov * (Math.PI / 180);
            const scale = 1 / Math.tan(fovRad / 2);
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (dz === 0) return { x: 0, y: 0, distance, visible: false, z: 0 };
            
            // 투영 계산
            const projectedX = (dx / dz) * scale;
            const projectedY = (dy / dz) * scale;
            
            // 카메라 뒤에 있는 점은 보이지 않음
            const visible = dz > 0;
            
            return { 
                x: projectedX * 100,
                y: projectedY * 100, 
                distance, 
                visible, 
                z: dz 
            };
        });
        
        // Z-order 정렬 (뒤에서 앞으로 그리기)
        projectedPoints.sort((a, b) => {
            return (a.z || 0) - (b.z || 0);
        });
        
        // 포인트 그리기
        projectedPoints.forEach(point => {
            if (!point.visible) return;
            
            // 거리에 따른 원 크기 계산
            const circleSize = Math.max(1, 2.5 - (point.distance / 200));
            
            graphics.beginFill(user.color);
            graphics.drawCircle(point.x, point.y, circleSize);
            graphics.endFill();
        });
    }
    
    // 트레일 생성 함수 수정 - 물방울 표면장력 효과
    function createTrail(x: number, y: number, color: number, size: number = 2, fromSurface: boolean = false, surfaceAngle: number = 0) {
        if (trails.length >= MAX_TRAILS) {
            // 가장 오래된 트레일 제거
            const oldestTrail = trails.shift();
            if (oldestTrail) {
                container.removeChild(oldestTrail.graphics);
                oldestTrail.graphics.destroy();
            }
        }
        
        const trail = new PIXI.Graphics();
        
        // 중앙 구체 위치 계산
        const centerScreenPos = projectPoint(0, 0, 0, camera);
        if (!centerScreenPos) return;
        
        // 표면에서 시작하는 경우, 시작점 조정
        let startPos = { x, y };
        if (fromSurface) {
            // 구체 표면에서 랜덤한 방향으로 약간 이동한 위치에서 시작
            const surfaceOffset = 20
            const randomAngle = surfaceAngle || Math.random() * Math.PI * 2;
            startPos = {
                x: x + Math.cos(randomAngle) * surfaceOffset,
                y: y + Math.sin(randomAngle) * surfaceOffset
            };
        }
        
        const endPos = { x: centerScreenPos.x, y: centerScreenPos.y };
        
        // 제어점 생성 (물방울 표면장력 효과를 위한 여러 제어점)
        const controlPoints = [];
        const segmentCount = 3; // 곡선 세그먼트 수
        
        // 두 점 사이의 거리와 각도 계산
        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // 물방울 효과를 위한 제어점 생성
        for (let i = 1; i <= segmentCount; i++) {
            const ratio = i / (segmentCount + 1);
            const deviation = (Math.random() - 0.5) * distance * 0.5; 
            const perpAngle = angle + Math.PI / 2;
            
            controlPoints.push({
                x: startPos.x + dx * ratio + Math.cos(perpAngle) * deviation,
                y: startPos.y + dy * ratio + Math.sin(perpAngle) * deviation
            });
        }
        
        // 그래픽 렌더링은 updateTrails에서 수행
        container.addChildAt(trail, container.children.indexOf(orbitContainer));
        
        trails.push({
            graphics: trail,
            life: 1, // 수명 약간 줄임 (2초에서 1.5초로)
            startPos,
            endPos,
            controlPoints,
            color,
            size
        });
    }
    
    // 트레일 업데이트 함수 수정
    function updateTrails(deltaTime: number) {
        for (let i = trails.length - 1; i >= 0; i--) {
            const trail = trails[i];
            trail.life -= deltaTime / 60; // 60fps 기준으로 감소
            
            // 트레일 그래픽 업데이트
            trail.graphics.clear();
            
            // 생명 비율 계산 (0~1)
            const lifeRatio = Math.max(0, Math.min(1, trail.life / 2));
            
            // 애니메이션 진행에 따른 중앙으로의 이동 비율
            const animationRatio = 1 - lifeRatio;
            
            // 시작점은 고정, 제어점들은 중앙으로 이동
            const currentPoints = trail.controlPoints.map((cp, index) => {
                // 중앙으로 이동하는 애니메이션 비율 (제어점마다 다른 속도로)
                const pointRatio = animationRatio * (1 + index * 0.2);
                return {
                    x: cp.x + (trail.endPos.x - cp.x) * pointRatio,
                    y: cp.y + (trail.endPos.y - cp.y) * pointRatio
                };
            });
            
            // 투명도 계산
            const alpha = lifeRatio * 0.3;
            
            // 베지어 곡선 그리기 (물방울 효과)
            if (lifeRatio > 0) {
                // 베지어 곡선 시작
                trail.graphics.lineStyle({
                    width: trail.size * lifeRatio * 1.2,
                    color: trail.color,
                    alpha: alpha
                });
                
                // 물방울 효과를 위한 곡선 그리기
                trail.graphics.moveTo(trail.startPos.x, trail.startPos.y);
                
                // 제어점을 이용한 부드러운 곡선 생성
                const pointsToRender = [trail.startPos, ...currentPoints, trail.endPos];
                
                // 베지어 곡선 렌더링
                for (let j = 0; j < pointsToRender.length - 1; j++) {
                    const start = pointsToRender[j];
                    const end = pointsToRender[j + 1];
                    
                    // 중간 제어점 계산
                    const tension = 0.1; // 곡선의 굴곡 강도
                    const cp1 = j > 0 ? {
                        x: start.x + (end.x - pointsToRender[j-1].x) * tension,
                        y: start.y + (end.y - pointsToRender[j-1].y) * tension
                    } : start;
                    
                    const cp2 = j < pointsToRender.length - 2 ? {
                        x: end.x - (pointsToRender[j+2].x - start.x) * tension,
                        y: end.y - (pointsToRender[j+2].y - start.y) * tension
                    } : end;
                    
                    trail.graphics.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
                }
                
                // 표면장력 효과를 위한 작은 원 추가
                for (let j = 0; j < currentPoints.length; j++) {
                    const point = currentPoints[j];
                    const pointSize = trail.size * 0.8 * lifeRatio * (1 - j * 0.2);
                    
                    trail.graphics.beginFill(trail.color, alpha * 0.7);
                    trail.graphics.drawCircle(point.x, point.y, pointSize);
                    trail.graphics.endFill();
                }
                
                // 끝점에 작은 원 추가
                trail.graphics.beginFill(trail.color, alpha);
                trail.graphics.drawCircle(trail.startPos.x, trail.startPos.y, trail.size * lifeRatio);
                trail.graphics.endFill();
            }
            
            // 수명이 다한 트레일 제거
            if (trail.life <= 0) {
                container.removeChild(trail.graphics);
                trail.graphics.destroy();
                trails.splice(i, 1);
            }
        }
    }

    // 사용자 궤도 업데이트 함수 수정
    function updateOrbits(deltaTime: number) {
        for (const user of connectedUsers) {
            // 궤도 반경 (거리)
            const orbitRadius = 200;
            
            // 자이로스코프 값을 라디안으로 변환
            const alphaRad = user.orbit.alpha * (Math.PI / 180);
            const betaRad = user.orbit.beta * (Math.PI / 90);
            const gammaRad = user.orbit.gamma * (Math.PI / 180);
            
            // 회전 계산
            const x = orbitRadius * Math.sin(alphaRad) * Math.cos(betaRad * 0.5);
            const z = orbitRadius * Math.cos(alphaRad) * Math.cos(betaRad * 0.5);
            const y = orbitRadius * Math.sin(betaRad * 0.5);
            
            // 위치 및 크기 업데이트
            if (user.orbitGraphics) {
                const graphics = user.orbitGraphics.baseObject;
                graphics.clear();
                
                // 3D 구체를 그리는 함수로 대체
                drawUserSphere(user, graphics, x, y, z, camera);
                
                // 트레일 생성 - 매 프레임마다 생성 (확률 100%로 변경)
                const screenPos = projectPoint(x, y, z, camera);
                if (screenPos) {
                    // 구체 표면에서 여러 트레일 생성
                    for (let i = 0; i < 2; i++) {
                        // 구체 표면의 랜덤한 각도
                        const surfaceAngle = Math.random() * Math.PI * 2;
                        createTrail(
                            screenPos.x, 
                            screenPos.y, 
                            user.color, 
                            3, // 크기 약간 증가
                            true, // 표면에서 시작
                            surfaceAngle
                        );
                    }
                }
            }
        }
    }

    // 3D 좌표를 2D 화면 좌표로 변환하는 헬퍼 함수
    function projectPoint(x: number, y: number, z: number, camera: Camera) {
        // 카메라 상대 좌표로 변환
        const dx = x - camera.x;
        const dy = y - camera.y;
        const dz = z - camera.z;
        
        // 카메라 뒤에 있는 점은 보이지 않음
        if (dz <= 0) return null;
        
        // 원근 투영 계산
        const fovRad = camera.fov * (Math.PI / 180);
        const scale = 1 / Math.tan(fovRad / 2);
        
        // 투영 계산
        const projectedX = (dx / dz) * scale * 100;
        const projectedY = (dy / dz) * scale * 100;
        
        return { x: projectedX, y: projectedY };
    }

    // 구체 그리기 함수
    function drawSphere(sphere: Sphere, graphics: any, camera: Camera) {
        graphics.clear();
        // 구체의 포인트 생성
        const points: { x: number, y: number, z: number }[] = [];
        const radius = sphere.radius;
        const segments = sphere.segments;
        
        // 피보나치 분포를 사용한 구 포인트 생성
        // 이 방법은 구면상에 균일하게 점을 분포시킴
        const numPoints = segments * segments;
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        
        for (let i = 0; i < numPoints; i++) {
            const theta = 2 * Math.PI * i / goldenRatio;
            const phi = Math.acos(1 - 2 * (i + 0.5) / numPoints);
            
            points.push({
                x: radius * Math.cos(theta) * Math.sin(phi),
                y: radius * Math.sin(theta) * Math.sin(phi),
                z: radius * Math.cos(phi)
            });
        }
        
        // 회전 적용
        const rotatedPoints = points.map(p => {
            // X축 회전
            let y1 = p.y * Math.cos(sphere.rotation.x) - p.z * Math.sin(sphere.rotation.x);
            let z1 = p.y * Math.sin(sphere.rotation.x) + p.z * Math.cos(sphere.rotation.x);
            
            // Y축 회전
            let x2 = p.x * Math.cos(sphere.rotation.y) + z1 * Math.sin(sphere.rotation.y);
            let z2 = -p.x * Math.sin(sphere.rotation.y) + z1 * Math.cos(sphere.rotation.y);
            
            // Z축 회전
            let x3 = x2 * Math.cos(sphere.rotation.z) - y1 * Math.sin(sphere.rotation.z);
            let y3 = x2 * Math.sin(sphere.rotation.z) + y1 * Math.cos(sphere.rotation.z);
            
            return { x: x3 + sphere.x, y: y3 + sphere.y, z: z2 + sphere.z };
        });
        
        // 3D -> 2D 투영
        const projectedPoints = rotatedPoints.map(p => {
            // 카메라 상대 좌표로 변환
            const dx = p.x - camera.x;
            const dy = p.y - camera.y;
            const dz = p.z - camera.z;
            
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
            
            return { x: projectedX * 100, y: projectedY * 100, distance: distance, visible, z: dz };
        });
        
        // Z-order 정렬 (뒤에서 앞으로 그리기)
        projectedPoints.sort((a, b) => {
            return (a.z || 0) - (b.z || 0);
        });
        
        const maxY = Math.max(...projectedPoints.map(p => p.y));
        const minY = Math.min(...projectedPoints.map(p => p.y));
        const rangeY = maxY - minY;
        
        // 포인트 그리기
        projectedPoints.forEach(point => {
            if (!point.visible) return;
            
            // 거리에 따른 원 크기 계산 (멀수록 작게, 가까울수록 크게)
            const circleSize = Math.max(1, 4 - (point.distance / 100));
            
            // point.y 값에 따라 색상 인덱스 계산
            const normalizedY = (point.y - minY) / (rangeY || 1);  // 0 나누기 방지
            const colorIndex = Math.min(Math.floor(normalizedY * (sphere.colors.length-1)), sphere.colors.length - 1);

            // 색상 블렌딩 계산
            let color;
            if (colorIndex < sphere.colors.length - 1) {
                // 두 색상 사이의 정확한 위치 계산
                const colorPosition = normalizedY * (sphere.colors.length - 1);
                const lowerColorIndex = Math.floor(colorPosition);
                const upperColorIndex = Math.ceil(colorPosition);
                const blendFactor = colorPosition - lowerColorIndex;
                
                // 두 색상 추출
                const lowerColor = sphere.colors[lowerColorIndex];
                const upperColor = sphere.colors[upperColorIndex];
                
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
                color = sphere.colors[colorIndex];
            }
            
            graphics.beginFill(color);
            graphics.drawCircle(point.x, point.y, circleSize);
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
        for (const layer of sphereLayers) {
            container.removeChild(layer);
            layer.destroy();
        }
        sphereLayers.length = 0;
    }
    
    // 창이 닫힐 때 정리
    window.addEventListener('beforeunload', cleanup);
}

// 애플리케이션 시작
initApp();
