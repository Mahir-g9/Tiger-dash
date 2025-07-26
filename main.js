
try {
    // Game constants main
const GRAVITY = 0.5;
const JUMP_FORCE = -12;
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 30;
const TIGER_WIDTH = 40;
const TIGER_HEIGHT = 30;
const OBSTACLE_WIDTH = 30;
const OBSTACLE_HEIGHT = 30;
const GROUND_HEIGHT = 50;
const GAME_SPEED = 3;

// Game variables
let canvas, ctx;
let gameWidth, gameHeight;
let groundY;
let score = 0;
let highScore = 0;
let gameRunning = true;
let currentSpeed = GAME_SPEED;

// Audio analysis variables
let audioCtx, analyser, dataArray;
let bgmVolumeLevel = 0;

//audios
let bgm = new Audio('./bgm.mp3');
  let bgmStarted = false;

bgm.loop = true;
bgm.volume = 0.5;

// Game objects
const player = {
    x: 0,
    y: 0,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    velocityY: 0,
    isJumping: false,
    isOnGround: false,
    currentPlatform: null,
    invincible: false,
    invincibleTimer: 0
};

const tiger = {
    x: 0,
    y: 0,
    width: TIGER_WIDTH,
    height: TIGER_HEIGHT,
    velocityY: 0,
    aiState: 'chasing',
    jumpCooldown: 0,
    isOnGround: true,
    hasJumpedCurrentObstacle: false
};

const obstacles = [];
const dangers = [];
let lastObstacleTime = 0;
const obstacleInterval = 2000;

// Initialize game
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    highScore = localStorage.getItem('highScore') || 0;
    document.getElementById('highScoreDisplay').textContent = `High Score: ${highScore}`;
    resetPositions();
    document.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('touchstart', handleTouch);
    document.getElementById('restartButton').addEventListener('click', restartGame);
    // Handle tab visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Handle page/tab closing
    window.addEventListener('beforeunload', handleBeforeUnload);
    // Handle page refresh
    window.addEventListener('unload', handleBeforeUnload);
    initAudioAnalysis();
    gameLoop();
}

function initAudioAnalysis() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        
        const source = audioCtx.createMediaElementSource(bgm);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        bgm.play().catch(e => console.log("Auto-play prevented:", e));
    } catch (e) {
        console.error("Audio analysis initialization failed:", e);
    }
}

function analyzeAudio() {
    if (!analyser) return 0;
    
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    bgmVolumeLevel = sum / dataArray.length;
    return bgmVolumeLevel;
}

function getBackgroundColor() {
    const volume = bgmVolumeLevel;
    if (volume < 50) {
        shake(0.2, 2);
        return '#6495ED';
        
    }
    else if (volume < 100) {
        shake(0.5, 2);
        return '#FF4D00';
        
    }
    else if (volume < 140) {
        shake(0.7, 2);
        return '#FFA500';}
    else if (volume < 160) {
        shake(1, 2);
        return '#B22222';}
    else {
        shake(1.5, 2);
        return '#380000';}
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Center the ground vertically
    groundY = canvas.height / 2 + GROUND_HEIGHT / 2;
    resetPositions();
}

function resetPositions() {
    player.x = canvas.width / 2 - player.width / 2;
    player.y = groundY - player.height;
    player.velocityY = 0;
    player.isJumping = false;
    player.isOnGround = true;
    player.currentPlatform = null;
    player.invincible = false;
    player.invincibleTimer = 0;

    tiger.x = player.x - 150;
    tiger.y = groundY - tiger.height;
    tiger.velocityY = 0;
    tiger.isOnGround = true;
    tiger.hasJumpedCurrentObstacle = false;
}

function handleKeyDown(e) {
    if (e.code === 'Space' && !player.isJumping && gameRunning) {
        playerJump();
        
    }
}

function handleTouch(e) {
    if (!player.isJumping && gameRunning) {
        playerJump();
        e.preventDefault();
    }
}

function playerJump() {
   if (!bgmStarted) {
    bgm.play().catch(e => console.log("Auto-play prevented:", e));
    bgmStarted = true;
}
player.velocityY = JUMP_FORCE;
player.isJumping = true;
player.isOnGround = false;
}

function restartGame() {
    obstacles.length = 0;
    dangers.length = 0;
    resetPositions();
    score = 0;
    document.getElementById('scoreDisplay').textContent = `Score: ${score}`;
    gameRunning = true;
    currentSpeed = GAME_SPEED;
    lastObstacleTime = Date.now();
    
    // Reset and play BGM only if the tab is active
    if (!document.hidden) {
        bgm.currentTime = 0;
        bgm.play().catch(e => console.log("Auto-play prevented:", e));
    }
}

function update() {
    if (!gameRunning) return;

    if (player.invincible) {
        player.invincibleTimer--;
        if (player.invincibleTimer <= 0) {
            player.invincible = false;
        }
    }

    score++;
    document.getElementById('scoreDisplay').textContent = `Score: ${score}`;
    updatePlayer();
    updateTiger();

    const currentTime = Date.now();
    if (currentTime - lastObstacleTime > obstacleInterval + Math.random() * 1000) {
        createObstacle();
        lastObstacleTime = currentTime;
    }

    updateObstacles();
    updateDangers();

    if (checkCollision(player, tiger) && !player.invincible) {
        triggerGameOver(false);
    }

    currentSpeed = GAME_SPEED + Math.floor(score / 1000) * 0.5;
    analyzeAudio();
}

function updatePlayer() {
    // Apply gravity
    player.velocityY += GRAVITY;
    player.y += player.velocityY;

    // Reset ground state
    player.isOnGround = false;
    player.currentPlatform = null;

    // Check ground collision first
    if (player.y + player.height >= groundY) {
        player.y = groundY - player.height;
        player.velocityY = 0;
        player.isJumping = false;
        player.isOnGround = true;
    }

    // Check all obstacles
    for (const obstacle of obstacles) {
        if (checkCollision(player, obstacle)) {
            if (obstacle.type === 'box') {
                // Check if landing on top of box
                if (player.velocityY > 0 && 
                    player.y + player.height >= obstacle.y - 5 &&
                    player.y + player.height <= obstacle.y + 10) {
                    
                    player.y = obstacle.y - player.height;
                    player.velocityY = 0;
                    player.isJumping = false;
                    player.isOnGround = true;
                    player.currentPlatform = obstacle;
                } 
                // Check if hitting from below or sides
                else if (!player.invincible) {
                    triggerGameOver(false);
                    return;
                }
            } else {
                // All other obstacles are deadly
                if (!player.invincible) {
                    triggerGameOver(false);
                    return;
                }
            }
        }
    }

    // Check dangers
    for (let i = dangers.length - 1; i >= 0; i--) {
        if (checkCollision(player, dangers[i])) {
            if (!player.invincible) {
                triggerGameOver(false);
                return;
            }
        }
    }

    // Check if fell off screen
    if (player.y > canvas.height && !player.invincible) {
        triggerGameOver(false);
        return;
    }

    // If on a platform that has moved off screen, fall
    if (player.currentPlatform && player.currentPlatform.x + player.currentPlatform.width < 0) {
        player.currentPlatform = null;
        player.isOnGround = false;
    }
}

function updateTiger() {
    tiger.velocityY += GRAVITY;
    tiger.y += tiger.velocityY;

    if (tiger.y + tiger.height >= groundY) {
        tiger.y = groundY - tiger.height;
        tiger.velocityY = 0;
        tiger.isOnGround = true;
        tiger.hasJumpedCurrentObstacle = false;
    } else {
        tiger.isOnGround = false;
    }

    updateTigerAI();
}

function updateTigerAI() {
    if (tiger.jumpCooldown > 0) {
        tiger.jumpCooldown--;
        return;
    }

    let nearestObstacle = null;
    let minDistance = Infinity;

    for (const obstacle of obstacles) {
        const distance = obstacle.x - tiger.x;
        if (distance > 0 && distance < 250 && distance < minDistance) {
            nearestObstacle = obstacle;
            minDistance = distance;
        }
    }

    if (nearestObstacle && !tiger.hasJumpedCurrentObstacle &&
        tiger.isOnGround && minDistance < 200) {
        tiger.velocityY = JUMP_FORCE * 0.8;
        tiger.jumpCooldown = 30;
        tiger.isOnGround = false;
        tiger.hasJumpedCurrentObstacle = true;
        return;
    }

    const distanceToPlayer = player.x - tiger.x;
    if (distanceToPlayer > 100) {
        tiger.x += 2;
    } else if (distanceToPlayer < 80) {
        tiger.x -= 1;
    }
}

function createObstacle() {
    const types = ['fire', 'hole', 'box'];
    const type = types[Math.floor(Math.random() * types.length)];

    if (type === 'fire' && Math.random() < 0.4) {
        const baseX = canvas.width;
        for (let i = 0; i < 3; i++) {
            obstacles.push({
                x: baseX + i * (OBSTACLE_WIDTH - 50),
                y: groundY - OBSTACLE_HEIGHT,
                width: OBSTACLE_WIDTH,
                height: OBSTACLE_HEIGHT,
                type: 'fire',
                isGrouped: true
            });
        }
    } 
    else if (type === 'box') {
        const boxHeight = Math.random() > 0.5 ? 
            groundY - OBSTACLE_HEIGHT : // Ground level
            groundY - OBSTACLE_HEIGHT * (2 + Math.floor(Math.random() * 3)); // Air
        
        const newBox = {
            x: canvas.width,
            y: boxHeight,
            width: PLAYER_WIDTH * 10,
            height: OBSTACLE_HEIGHT,
            type: 'box',
            isGrouped: false
        };
        obstacles.push(newBox);
        if (boxHeight < groundY - OBSTACLE_HEIGHT && Math.random() > 0.5) {
            dangers.push({
                x: newBox.x + newBox.width/2 - OBSTACLE_WIDTH/2,
                y: newBox.y - OBSTACLE_HEIGHT/2,  // Half height danger
                width: OBSTACLE_WIDTH,
                height: OBSTACLE_HEIGHT/2,  // Smaller hitbox
                type: 'box',
                parentBox: newBox  // Reference to parent box
            });
        }
    }
    else {
        const yPos = type === 'fire' ? groundY - OBSTACLE_HEIGHT : groundY - 10;
        obstacles.push({
            x: canvas.width,
            y: yPos,
            width: OBSTACLE_WIDTH + Math.random() * 20,
            height: type === 'fire' ? OBSTACLE_HEIGHT : 10,
            type: type,
            isGrouped: false
        });
    }
}

function updateObstacles() {
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= currentSpeed;

        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
            continue;
        }
    }
}

function updateDangers() {
    for (let i = dangers.length - 1; i >= 0; i--) {
        dangers[i].x -= currentSpeed;

        if (dangers[i].x + dangers[i].width < 0) {
            dangers.splice(i, 1);
        }
    }
}

function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

function triggerGameOver(playerWon) {
    if (!gameRunning) return;
    
    gameRunning = false;
    bgm.pause();

    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';

    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = '#fff';
    modalContent.style.padding = '2rem';
    modalContent.style.borderRadius = '10px';
    modalContent.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
    modalContent.style.textAlign = 'center';
    modalContent.style.maxWidth = '400px';
    modalContent.style.width = '80%';

    const title = document.createElement('h2');
    title.style.margin = '0 0 1rem 0';
    title.style.fontSize = '2rem';
    
    const message = document.createElement('p');
    message.style.margin = '0 0 1.5rem 0';
    message.style.fontSize = '1.2rem';
    
    const restartButton = document.createElement('button');
    restartButton.textContent = 'Play Again';
    restartButton.style.padding = '0.8rem 1.8rem';
    restartButton.style.fontSize = '1rem';
    restartButton.style.backgroundColor = '#4CAF50';
    restartButton.style.color = 'white';
    restartButton.style.border = 'none';
    restartButton.style.borderRadius = '5px';
    restartButton.style.cursor = 'pointer';
    restartButton.style.transition = 'background-color 0.3s';

    restartButton.onmouseover = function() {
        this.style.backgroundColor = '#45a049';
    };
    restartButton.onmouseout = function() {
        this.style.backgroundColor = '#4CAF50';
    };

    restartButton.onclick = function() {
        document.body.removeChild(modal);
        restartGame();
    };

    if (playerWon) {
        title.textContent = 'You Won!';
        title.style.color = '#4CAF50';
        message.textContent = `Congratulations! Your score: ${score}`;
    } else {
        title.textContent = 'Game Over!';
        title.style.color = '#f44336';
        message.textContent = `Your score: ${score}`;
    }

    modalContent.appendChild(title);
    modalContent.appendChild(message);
    modalContent.appendChild(restartButton);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
        document.getElementById('highScoreDisplay').textContent = `High Score: ${highScore}`;
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getBackgroundColor();
    ctx.fillRect(0, 0, canvas.width, groundY - GROUND_HEIGHT/2); // Above ground
    ctx.fillRect(0, groundY + GROUND_HEIGHT/2, canvas.width, canvas.height - groundY - GROUND_HEIGHT/2); // Below ground

    // Draw ground
    ctx.fillStyle = '#2E8B57';
    ctx.fillRect(0, groundY - GROUND_HEIGHT/2, canvas.width, GROUND_HEIGHT);

    drawObstacles();
    drawDangers();
    drawPlayer();
    drawTiger();
}

function drawObstacles() {
    obstacles.forEach(obstacle => {
        if (obstacle.type === 'fire') {
            // Fire obstacle
            ctx.fillStyle = '#FF4500';
            ctx.beginPath();
            ctx.moveTo(obstacle.x, obstacle.y + obstacle.height);
            ctx.lineTo(obstacle.x + obstacle.width / 2, obstacle.y);
            ctx.lineTo(obstacle.x + obstacle.width, obstacle.y + obstacle.height);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#FFA500';
            ctx.beginPath();
            ctx.moveTo(obstacle.x + 5, obstacle.y + obstacle.height - 5);
            ctx.lineTo(obstacle.x + obstacle.width / 2, obstacle.y + 5);
            ctx.lineTo(obstacle.x + obstacle.width - 5, obstacle.y + obstacle.height - 5);
            ctx.closePath();
            ctx.fill();
        } 
        else if (obstacle.type === 'box') {
            // Draw box
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // Draw wood texture
            ctx.fillStyle = '#A0522D';
            for (let i = 0; i < obstacle.width; i += 15) {
                ctx.fillRect(obstacle.x + i, obstacle.y, 10, obstacle.height);
            }
            
            // Draw top surface
            ctx.fillStyle = '#654321';
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, 5);
        }
        else {
            // Hole or other obstacle
            ctx.fillStyle = '#654321';
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
    });
}

function drawDangers() {
    console.clear();
}
function drawPlayer() {
    // Flash player if invincible
    if (player.invincible && Math.floor(Date.now() / 100) % 2 === 0) {
        ctx.fillStyle = '#FF0000';
    } else {
        ctx.fillStyle = '#0000FF';
    }
    
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Draw eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(player.x + player.width - 10, player.y + 5, 5, 5);
    ctx.fillRect(player.x + player.width - 10, player.y + 20, 5, 5);
}

function drawTiger() {
    ctx.fillStyle = '#FF8C00';
    ctx.fillRect(tiger.x, tiger.y, tiger.width, tiger.height);
    ctx.fillStyle = '#000000';
    for (let i = 0; i < 3; i++) {
        ctx.fillRect(tiger.x + 5 + i * 10, tiger.y + 5, 5, tiger.height - 10);
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(tiger.x + tiger.width - 10, tiger.y + 5, 5, 5);
    ctx.fillRect(tiger.x + tiger.width - 10, tiger.y + 20, 5, 5);
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}


window.onload = init;

function handleVisibilityChange() {
    if (document.hidden) {
        if (!bgm.paused) {
            bgm.pause();
        }
    } else {
        if (gameRunning && bgm.paused) {
            bgm.play().catch(e => console.log("Auto-play prevented:", e));
        }
    }
}
function handleBeforeUnload() {
    if (!bgm.paused) {
        bgm.pause();
        bgm.currentTime = 0;
    }
}
setInterval(()=>{
    console.clear();
}, 100);
} catch (e) {
    alert('error'+e);
}
function shake(shakeSpeed = 1, duration = 500) {
  shakeSpeed = Math.min(Math.max(shakeSpeed, 0.1), 5);
  const styleId = "custom-shake-style";
  let styleTag = document.getElementById(styleId);
  if (styleTag) styleTag.remove();
  const px = Math.floor(shakeSpeed * 5);
  styleTag = document.createElement("style");
  styleTag.id = styleId;
  const animDuration = (0.6 / shakeSpeed).toFixed(2)
  styleTag.innerHTML = `
    @keyframes shakeAll {
      0%   { transform: translate(0, 0); }
      25%  { transform: translate(-${px}px, ${px}px); }
      50%  { transform: translate(${px}px, -${px}px); }
      75%  { transform: translate(-${px}px, ${px}px); }
      100% { transform: translate(0, 0); }
    }
    * {
      animation: shakeAll ${animDuration}s infinite;
    }
  `;
  document.head.appendChild(styleTag);
function getBackgroundColor() {
    const volume = bgmVolumeLevel;
    if (volume < 50) return '#6495ED';
    else if (volume < 100) return '#FF4D00';
    else if (volume < 140) return '#FFA500';
    else if (volume < 160) return '#B22222';
    else return '#380000';
}
  // Remove shake after duration
  setTimeout(() => {
    styleTag.remove();
  }, duration);
}
