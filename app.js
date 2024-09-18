const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");
const app = express();
const server = http.createServer(app);

const io = socket(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.render("index", { title: "Chess Game" });
});

let games = {};  // Store game sessions

io.on("connection", (uniquesocket) => {
    console.log("connected");

    uniquesocket.on("joinGame", () => {
        // Find or create a game for the player
        let gameRoom = findAvailableRoom();

        if (!gameRoom) {
            gameRoom = createNewGame(uniquesocket);
            uniquesocket.emit("waitingForOpponent");
        } else {
            joinGameAsBlack(gameRoom, uniquesocket);
            io.to(gameRoom).emit("opponentJoined");
        }

        uniquesocket.on("move", (move) => handleMove(gameRoom, uniquesocket, move));
        uniquesocket.on("disconnect", () => handleDisconnect(gameRoom, uniquesocket));
    });
});

function findAvailableRoom() {
    // Look for a game room with only one player (white)
    for (let roomId in games) {
        const game = games[roomId];
        if (!game.black) {
            return roomId;
        }
    }
    return null;
}

function createNewGame(uniquesocket) {
    const roomId = uniquesocket.id;  // Unique room ID
    games[roomId] = {
        chess: new Chess(),
        white: uniquesocket.id,  // Assign the player as white
        black: null
    };
    uniquesocket.join(roomId);
    uniquesocket.emit("playerRole", "w");
    return roomId;
}

function joinGameAsBlack(gameRoom, uniquesocket) {
    games[gameRoom].black = uniquesocket.id;  // Assign the player as black
    uniquesocket.join(gameRoom);
    uniquesocket.emit("playerRole", "b");
    io.to(gameRoom).emit("gameStart", "The game has started!");
}

function handleMove(gameRoom, uniquesocket, move) {
    const game = games[gameRoom];
    const chess = game.chess;
    
    if (chess.turn() === "w" && uniquesocket.id !== game.white) return;
    if (chess.turn() === "b" && uniquesocket.id !== game.black) return;
    let result;
    try{

     result = chess.move(move);

    }
    catch(error){
        console.log(error);
    }
    if (result) {
        io.to(gameRoom).emit("move", move);
        io.to(gameRoom).emit("boardState", chess.fen());
    } else {

        uniquesocket.emit("invalidMove", move);
    }
}

function handleDisconnect(gameRoom, uniquesocket) {
    const game = games[gameRoom];
    if (!game) {
        return;  // Game doesn't exist, so exit the function
    }
    if (uniquesocket.id === game.white) {
        delete games[gameRoom];
        io.to(gameRoom).emit("playerDisconnected", "White player disconnected");
    } else if (uniquesocket.id === game.black) {
        game.black = null;
        io.to(gameRoom).emit("playerDisconnected", "Black player disconnected");
    }
}

server.listen(3000, function () {
    console.log("server is running on port 3000");
});
