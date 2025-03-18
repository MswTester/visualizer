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

io.on("connection", (socket: Socket) => {
    console.log(`[*] Connected: ${socket.id}`)
    socket.on("disconnect", () => {
        console.log(`[*] Disconnected: ${socket.id}`)
    })
})

server.listen(port, () => {
    console.log(`Server is listening on *:${port}`)
})