import express from "express";
import { createServer } from "http";
import { Server, Socket} from "socket.io";
import { join } from "path";

const app = express();
const server = createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;
const publicPath = join(process.cwd(), "public")

app.use(express.static(publicPath))
app.get("/", (req, res) => {
    console.log(publicPath)
    res.sendFile(join(publicPath, "index.html"))
})

// 모바일 기기용 라우트 추가
app.get("/mobile", (req, res) => {
    res.sendFile(join(publicPath, "mobile.html"))
})

// 연결된 사용자 관리
const connectedUsers = new Map();

io.on("connection", (socket: Socket) => {
    console.log(`[*] Connected: ${socket.id}`)
    
    // 클라이언트 유형 설정 (모바일 또는 디스플레이)
    socket.on("setClientType", (clientType: string) => {
        // 사용자 정보 저장
        connectedUsers.set(socket.id, { 
            clientType, 
            lastActivity: Date.now() 
        });
        
        // 모바일 클라이언트가 연결되면 메인 디스플레이에 알림
        if (clientType === "mobile") {
            io.emit("userConnected", socket.id);
            console.log(`[*] Mobile connected: ${socket.id}`);
        }
    });
    
    // 자이로스코프 데이터 수신 및 전달
    socket.on("gyroscopeData", (data: { alpha: number, beta: number, gamma: number }) => {
        // 사용자 정보 업데이트
        const userInfo = connectedUsers.get(socket.id);
        if (userInfo) {
            userInfo.lastActivity = Date.now();
            
            // 모든 디스플레이 클라이언트에게 데이터 전송
            io.emit("gyroscopeData", { 
                userId: socket.id,
                alpha: data.alpha,
                beta: data.beta, 
                gamma: data.gamma 
            });
        }
    });
    
    // 연결 종료 처리
    socket.on("disconnect", () => {
        console.log(`[*] Disconnected: ${socket.id}`);
        
        // 모바일 클라이언트가 연결 해제되면 메인 디스플레이에 알림
        const userInfo = connectedUsers.get(socket.id);
        if (userInfo && userInfo.clientType === "mobile") {
            io.emit("userDisconnected", socket.id);
        }
        
        // 사용자 정보 삭제
        connectedUsers.delete(socket.id);
    });
})

// 비활성 사용자 정리 (5분간 활동이 없는 사용자)
setInterval(() => {
    const now = Date.now();
    const inactivityThreshold = 5 * 60 * 1000; // 5분
    
    connectedUsers.forEach((userInfo, userId) => {
        if (now - userInfo.lastActivity > inactivityThreshold) {
            // 비활성 사용자 연결 종료
            const socket = io.sockets.sockets.get(userId);
            if (socket) {
                socket.disconnect(true);
                console.log(`[*] 비활성 사용자 연결 종료: ${userId}`);
            }
            connectedUsers.delete(userId);
        }
    });
}, 60 * 1000); // 1분마다 확인

server.listen(port, () => {
    console.log(`Server is listening on *:${port}`)
})