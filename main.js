const { Engine, Render, Runner, World, Bodies, Body, Composite, Constraint, Events, Vector, Bounds } = Matter;

const canvasEl = document.getElementById('simulationCanvas');
const simulationContainerEl = document.getElementById('simulationContainer');
const initialScreenContentEl = document.getElementById('initialScreenContent');
const startStopButtonEl = document.getElementById('startStopButton');
const resetSimulationButtonEl = document.getElementById('resetSimulationButton');
const aboutProjectButtonEl = document.getElementById('aboutProjectButton');
const algorithmTypeSelect = document.getElementById('algorithmType');
const populationSizeInput = document.getElementById('populationSize');
const populationSizeSlider = document.getElementById('populationSizeSlider');
const terrainComplexityInput = document.getElementById('terrainComplexity');
const terrainComplexityValue = document.getElementById('terrainComplexityValue');
const mutationRateInput = document.getElementById('mutationRate');
const mutationRateValue = document.getElementById('mutationRateValue');
const elitismRateInput = document.getElementById('elitismRate');
const elitismRateValue = document.getElementById('elitismRateValue');
const breedingPercentageInput = document.getElementById('breedingPercentage');
const breedingPercentageValue = document.getElementById('breedingPercentageValue');
const followLeaderButtonEl = document.getElementById('followLeaderButton');
const autoNextGenCheckbox = document.getElementById('autoNextGenCheckbox');
const algorithmDescriptionEl = document.getElementById('algorithmDescription');

const generationNumberDisplay = document.getElementById('generationNumber');
const currentBestDistanceDisplay = document.getElementById('currentBestDistance');
const overallBestDistanceDisplay = document.getElementById('overallBestDistance');
const activeCarsCountDisplay = document.getElementById('activeCarsCount');

const confirmResetModalEl = document.getElementById('confirmResetModal');
const confirmResetYesButton = document.getElementById('confirmResetYes');
const aboutProjectModalEl = document.getElementById('aboutProjectModal');

let engine, render, runner, world;
let population = [];
let generation = 0;
let overallBestFitness = 0;
let currentBestFitnessInGeneration = 0;
let terrainBodies = [];
const TERRAIN_SEGMENT_LENGTH = 100;
const TERRAIN_TOTAL_SEGMENTS = 500;
const TERRAIN_START_Y = 500;
const CAR_START_X = 150;
const CAR_START_Y = TERRAIN_START_Y - 60;
const MOTOR_SPEED = 0.4;
let simulationRunning = false;
let bestCarInGeneration = null;
let visuallyLeadingCarForCamera = null;
let lastUsedTerrainComplexity = parseFloat(terrainComplexityInput.value);


const TERRAIN_CATEGORY = 0x0001;
const CAR_CATEGORY = 0x0002;
const CAR_COLLISION_GROUP = -1;

let isDraggingCamera = false;
let lastMouse = { x: 0, y: 0 };
let dragStartPoint = { x: 0, y: 0 };
let initialRenderBoundsMin = { x: 0, y: 0 };
let isFollowLeaderActive = true;

const MIN_SIGNIFICANT_FORWARD_MOVE = 1.0;
const NO_SIGNIFICANT_PROGRESS_FRAMES = 360;
const EXTREME_LOW_VELOCITY_FRAMES = 180;
const TILTED_AND_SLOW_FRAMES = 150;

const algorithmDescriptions = {
    standard: "Standard: Two parents are selected from the breeding pool (tournament selection). Their genes are combined to create offspring, which is then mutated.",
    shuffle: "Shuffle: For each gene of the offspring, a random parent is chosen from the breeding pool. Genes are assembled like a 'mosaic', then mutated."
};

function random(min, max) {
    return Math.random() * (max - min) + min;
}

/* =====  НАСТРАИВАЕМЫЕ СПИСКИ  ===== */
const BASE_NAME_POOL = [
  // Славянские
  'Gavrila', 'Fedor', 'Fenya', 'Zoltan', 'Milos',
  'Oleg', 'Dunya', 'Sasha', 'Tanya', 'Vera',
  'Kolya', 'Ilya', 'Pasha', 'Stepan', 'Valera',
  'Nikita', 'Arkady', 'Grisha', 'Timur', 'Taisiya',

  // Европейские и англофонные
  'Matilda', 'Bjorn', 'Geralt', 'Anya', 'Lana',
  'Yelena', 'Irina', 'Zina', 'Katya', 'Liza',
  'Roman', 'Maxim', 'Viktor', 'Sergei', 'Alina',

  // Необычные, мультикультурные
  'Hadzhime', 'Aiko', 'Raj', 'Azamat', 'Zephyr',
  'Inga', 'Nova', 'Ariadne', 'Thorne', 'Yuki',
  'Iskra', 'Echo', 'Lyra', 'Ragnar', 'Ember'
];

const PREFIX_POOL = [
  'Mister', 'Sir', 'Lord', 'Doctor', 'Captain',
  'Comrade', 'General', 'Agent', 'Red', 'Dark',
  'Silent', 'Furious', 'Crazy', 'Iron', 'Steel',
  'Silent', 'Ghost', 'Shadow', 'Stoic', 'Savage'
];

const SUFFIX_POOL = [
  'Jr.', 'II', 'Prime', 'X', 'Max',
  'Ultra', 'Turbo', '2000', 'EX',
  'One', 'Zero', 'Nova', 'Plus', 'Infinity'
];

/* =====  ВЕРОЯТНОСТИ  ===== */
const PREFIX_PROBABILITY = 0.5;   // 50 % шанс иметь префикс
const SUFFIX_PROBABILITY = 0.2;   // 20 % шанс иметь суффикс

/* =====  Генератор уникальных имён  ===== */
let usedNames = new Set();               // очищается каждый раз при создании поколения

function pickRandomAndRemove(pool) {
    if (pool.length === 0) return null;
    const idx = Math.floor(Math.random() * pool.length);
    return pool.splice(idx, 1)[0];
}

function generateUniqueCarName() {
    // локальные копии пулов, чтобы не тратить исходные массивы за одну гонку
    if (BASE_NAME_POOL.length === 0) throw new Error('BASE_NAME_POOL пуст!');
    if (PREFIX_POOL.length === 0) throw new Error('PREFIX_POOL пуст!');
    if (SUFFIX_POOL.length === 0) throw new Error('SUFFIX_POOL пуст!');

    // чтобы при длинных популяциях имена не закончились, «обновляем» пулы, когда исчерпали всё
    if (BASE_NAME_POOL._scratch === undefined || BASE_NAME_POOL._scratch.length === 0)
        BASE_NAME_POOL._scratch = BASE_NAME_POOL.slice();
    if (PREFIX_POOL._scratch === undefined || PREFIX_POOL._scratch.length === 0)
        PREFIX_POOL._scratch = PREFIX_POOL.slice();
    if (SUFFIX_POOL._scratch === undefined || SUFFIX_POOL._scratch.length === 0)
        SUFFIX_POOL._scratch = SUFFIX_POOL.slice();

    let name;
    let tries = 0;
    do {
        const base = pickRandomAndRemove(BASE_NAME_POOL._scratch);
        const prefix = Math.random() < PREFIX_PROBABILITY
            ? pickRandomAndRemove(PREFIX_POOL._scratch)
            : null;
        const suffix = Math.random() < SUFFIX_PROBABILITY
            ? pickRandomAndRemove(SUFFIX_POOL._scratch)
            : null;

        name = [
            prefix ? `${prefix}` : '',
            base,
            suffix ? `${suffix}` : ''
        ].filter(Boolean).join(' ');
        tries++;
    } while (usedNames.has(name) && tries < 500);

    usedNames.add(name);
    return name;
}


function handleMouseDown(event) {
    if (event.target === canvasEl || event.target === simulationContainerEl) {
        isDraggingCamera = true;
        dragStartPoint.x = event.clientX;
        dragStartPoint.y = event.clientY;
        if (render && render.bounds) {
            initialRenderBoundsMin.x = render.bounds.min.x;
            initialRenderBoundsMin.y = render.bounds.min.y;
        }
        simulationContainerEl.style.cursor = 'grabbing';
        if (isFollowLeaderActive) {
            isFollowLeaderActive = false;
            followLeaderButtonEl.classList.remove('active');
        }
    }
}

function handleMouseMove(event) {
    if (isDraggingCamera && render && render.bounds && render.options) {
        const totalDeltaX = event.clientX - dragStartPoint.x;
        const totalDeltaY = event.clientY - dragStartPoint.y;

        const newMinX = initialRenderBoundsMin.x - totalDeltaX;
        const newMinY = initialRenderBoundsMin.y - totalDeltaY;

        Bounds.translate(render.bounds, Vector.create(newMinX - render.bounds.min.x, newMinY - render.bounds.min.y));
    }
}

function handleMouseUp() {
    if (isDraggingCamera) {
        isDraggingCamera = false;
        simulationContainerEl.style.cursor = 'grab';
    }
}

function setupMatterJs() {
    engine = Engine.create();
    world = engine.world;
    world.gravity.y = 1;
    engine.timing.timeScale = 1;
    engine.velocityIterations = 6;
    engine.positionIterations = 8;

    let canvasWidth = simulationContainerEl.clientWidth;
    let canvasHeight = simulationContainerEl.clientHeight;

    canvasEl.width = canvasWidth;
    canvasEl.height = canvasHeight;

    render = Render.create({
        canvas: canvasEl,
        engine: engine,
        options: {
            width: canvasWidth,
            height: canvasHeight,
            wireframes: false,
            background: '#e0e0e0',
            hasBounds: true
        }
    });

    runner = Runner.create();
    Render.run(render);
    Runner.run(runner, engine);

    simulationContainerEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);


    Events.on(engine, 'afterUpdate', () => {
        if (!simulationRunning || !engine) return;

        let currentFrameBestCarForEvolution = null;
        let maxDistThisFrame = -Infinity;

        visuallyLeadingCarForCamera = null;
        let maxCurrentXForCamera = -Infinity;

        let aliveCount = 0;

        population.forEach(car => {
            if (car.isAlive && car.chassis && car.chassis.position) {
                car.update();

                if (car.maxDistance > maxDistThisFrame) {
                    maxDistThisFrame = car.maxDistance;
                    currentFrameBestCarForEvolution = car;
                }

                if (car.isAlive && car.chassis.position.x > maxCurrentXForCamera) {
                    maxCurrentXForCamera = car.chassis.position.x;
                    visuallyLeadingCarForCamera = car;
                }

                if (car.isAlive) aliveCount++;
            } else if (car.isAlive && (!car.chassis || !car.chassis.position)) {
                if (car.isAlive) console.log(`Car ${car.id} died: Missing chassis or position in main loop.`);
                car.isAlive = false;
            }
        });

        activeCarsCountDisplay.textContent = aliveCount;

        if (currentFrameBestCarForEvolution) {
            if (!bestCarInGeneration || currentFrameBestCarForEvolution.maxDistance > bestCarInGeneration.maxDistance) {
                bestCarInGeneration = currentFrameBestCarForEvolution;
            }
        }

        if (maxDistThisFrame > currentBestFitnessInGeneration && maxDistThisFrame !== -Infinity) {
            currentBestFitnessInGeneration = maxDistThisFrame;
        }
        if (currentBestFitnessInGeneration > overallBestFitness) {
            overallBestFitness = currentBestFitnessInGeneration;
        }

        updateDisplays();
        let cameraTarget = visuallyLeadingCarForCamera;
        if (!cameraTarget && bestCarInGeneration && bestCarInGeneration.isAlive && bestCarInGeneration.chassis && bestCarInGeneration.chassis.position) {
            cameraTarget = bestCarInGeneration;
        }
        updateCamera(cameraTarget);


        if (aliveCount === 0 && simulationRunning) {
            endGeneration();
        }
    });

    Events.on(render, 'afterRender', () => {
        if (!render || !render.context) return;

        const ctx = render.context;
        population.forEach(car => {
            if (car.isAlive && car.chassis && car.chassis.position && car.chassis.bounds) {
                ctx.fillStyle = 'black';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';

                const chassis = car.chassis;

                const worldTextX = chassis.position.x;
                const worldTextY = chassis.bounds.min.y - 15;

                const viewTextX = worldTextX - render.bounds.min.x;
                const viewTextY = worldTextY - render.bounds.min.y;

                ctx.fillText(`${car.id} (${car.maxDistance.toFixed(0)})`, viewTextX, viewTextY);
                ctx.textAlign = 'start';
            }
        });
    });
}

function generateTerrain() {
    if (world && terrainBodies.length > 0) {
        World.remove(world, terrainBodies);
    }
    terrainBodies = [];

    let currentX = -TERRAIN_SEGMENT_LENGTH * 10;
    let currentY = TERRAIN_START_Y;
    let lastFeatureEnd = currentX;
    const complexity = parseFloat(terrainComplexityInput.value);
    lastUsedTerrainComplexity = complexity;

    for (let i = 0; i < TERRAIN_TOTAL_SEGMENTS + 20; i++) {
        const nextX = currentX + TERRAIN_SEGMENT_LENGTH;
        let nextY = currentY;
        const progress = Math.min(1, (i - 10) / (TERRAIN_TOTAL_SEGMENTS * 0.3));

        if (i < 10) {
            nextY = TERRAIN_START_Y;
        } else if (currentX > lastFeatureEnd + TERRAIN_SEGMENT_LENGTH * random(0.05 / complexity, 0.15 / complexity)) {
            const featureRoll = Math.random();
            let featurePlaced = false;

            if (featureRoll < (0.55 + progress * 0.2) * complexity * 0.8) {
                const rampHeight = random(100 * complexity, (300 + 800 * progress) * complexity);
                const rampSegments = Math.floor(random(1, 1.15));
                nextY = currentY - rampHeight;
                let rampCurrentX = currentX;
                for (let r = 0; r < rampSegments; r++) {
                    const rampNextX = rampCurrentX + TERRAIN_SEGMENT_LENGTH;
                    const rampNextY = currentY - (rampHeight * ((r + 1) / rampSegments));
                    terrainBodies.push(Bodies.rectangle((rampCurrentX + rampNextX) / 2, (currentY + rampNextY) / 2 + 10, TERRAIN_SEGMENT_LENGTH + 10, 40, { isStatic: true, friction: 0.9, angle: Math.atan2(rampNextY - currentY, rampNextX - rampCurrentX), render: { fillStyle: '#4a2d1a' } }));
                    currentY = rampNextY;
                    rampCurrentX = rampNextX;
                }
                currentX = rampCurrentX - TERRAIN_SEGMENT_LENGTH;
                nextY = currentY;
                lastFeatureEnd = currentX + TERRAIN_SEGMENT_LENGTH * rampSegments;
                featurePlaced = true;
            } else if (featureRoll < (0.88 + progress * 0.1) * complexity * 0.7 && i > 12) {
                const dropHeight = random(300 * complexity, (700 + 700 * progress) * complexity);
                nextY = currentY + dropHeight;
                lastFeatureEnd = nextX;
                featurePlaced = true;
            } else if (featureRoll < (0.93 + progress * 0.05) * complexity * 0.6 && i > 18 && TERRAIN_TOTAL_SEGMENTS - i > 10) {
                const gapSize = 1;
                currentX += TERRAIN_SEGMENT_LENGTH * gapSize;
                lastFeatureEnd = currentX;
                i += gapSize - 1;
                featurePlaced = true;
                nextY = TERRAIN_START_Y + random(-200 * complexity, 200 * complexity) * progress;
            }

            if (!featurePlaced) {
                const maxSineAmplitude = (120 + 380 * progress) * complexity;
                const maxNoiseAmplitude = (60 + 200 * progress) * complexity;
                const sineFrequency = 0.1 + 0.25 * progress;
                nextY = TERRAIN_START_Y +
                    Math.sin(i * sineFrequency) * random(maxSineAmplitude * 0.6, maxSineAmplitude) +
                    random(-maxNoiseAmplitude, maxNoiseAmplitude);
                lastFeatureEnd = nextX;
            }

        } else {
            const maxSineAmplitude = (120 + 380 * progress) * complexity;
            const maxNoiseAmplitude = (60 + 200 * progress) * complexity;
            const sineFrequency = 0.1 + 0.25 * progress;
            nextY = TERRAIN_START_Y +
                Math.sin(i * sineFrequency) * random(maxSineAmplitude * 0.6, maxSineAmplitude) +
                random(-maxNoiseAmplitude, maxNoiseAmplitude);
            lastFeatureEnd = nextX;
        }

        nextY = Math.max(TERRAIN_START_Y - (750 * complexity), Math.min(TERRAIN_START_Y + (750 * complexity), nextY));

        const path = [
            { x: currentX, y: TERRAIN_START_Y + 300 },
            { x: nextX, y: TERRAIN_START_Y + 300 },
            { x: nextX, y: nextY },
            { x: currentX, y: currentY }
        ];
        const groundSegment = Bodies.fromVertices((currentX + nextX) / 2, (currentY + nextY + TERRAIN_START_Y + 300) / 2, [path], {
            isStatic: true,
            friction: 0.9,
            render: { fillStyle: `hsl(${100 + (i * 2 % 180)}, 30%, 40%)` },
            collisionFilter: {
                category: TERRAIN_CATEGORY,
                mask: CAR_CATEGORY
            }
        }, true);
        terrainBodies.push(groundSegment);

        currentX = nextX;
        currentY = nextY;
    }
    if (world) {
        Composite.add(world, terrainBodies);
    }
}

class Car {
    constructor(genes, id) {
        this.id = id;
        this.genes = genes || this.generateRandomGenes();
        this.fitness = 0;
        this.matterBody = null;
        this.chassis = null;
        this.wheels = [];
        this.constraints = [];
        this.isAlive = true;
        this.maxDistance = 0;
        this.color = `hsl(${random(0, 360)}, 70%, 60%)`;

        this.framesSinceNoSignificantProgress = 0;
        this.framesAtExtremelyLowVelocity = 0;
        this.framesTiltedAndSlow = 0;
        this.lastMaxDistanceCheck = 0;
    }

    generateRandomGenes() {
        const numBodyVert = Math.floor(random(3, 8.99));
        const bodyVertices = [];
        const angleStep = (2 * Math.PI) / numBodyVert;
        const baseBodyRadius = random(25, 45);
        for (let i = 0; i < numBodyVert; i++) {
            const radius = baseBodyRadius + random(-10, 10);
            bodyVertices.push({
                x: radius * Math.cos(i * angleStep + random(-0.2, 0.2)),
                y: radius * Math.sin(i * angleStep + random(-0.2, 0.2))
            });
        }
        bodyVertices.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));

        const numWh = Math.floor(random(0, 4.99));
        const wheelGenes = [];
        for (let i = 0; i < numWh; i++) {
            wheelGenes.push({
                vertexIndex: Math.floor(random(0, numBodyVert)),
                radius: random(10, 20),
                ovality: random(0.5, 1.5)
            });
        }
        return {
            numBodyVertices: numBodyVert,
            bodyVertices,
            numWheels: numWh,
            wheels: wheelGenes,
            chassisScale: random(0.7, 1.5)
        };
    }

    generateEllipseVertices(radiusX, radiusY, segments = 16) {
        const vertices = [];
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * 2 * Math.PI;
            vertices.push({
                x: radiusX * Math.cos(angle),
                y: radiusY * Math.sin(angle)
            });
        }
        return vertices;
    }

    createBody(x, y) {
        if (!this.genes || !this.genes.bodyVertices || this.genes.bodyVertices.length < 3 || !this.genes.wheels || typeof this.genes.chassisScale === 'undefined') {
            this.isAlive = false;
            return;
        }

        const scaledBodyVertices = this.genes.bodyVertices.map(v => ({
            x: v.x * this.genes.chassisScale,
            y: v.y * this.genes.chassisScale
        }));

        this.chassis = Bodies.fromVertices(x, y, [scaledBodyVertices], {
            friction: 0.8,
            density: 0.008,
            render: { fillStyle: this.color },
            collisionFilter: {
                category: CAR_CATEGORY,
                mask: TERRAIN_CATEGORY,
                group: CAR_COLLISION_GROUP
            }
        });

        this.wheels = [];
        this.constraints = [];

        this.genes.wheels.forEach(wheelGene => {
            if (wheelGene.vertexIndex < 0 || wheelGene.vertexIndex >= this.genes.bodyVertices.length) {
                wheelGene.vertexIndex = Math.max(0, this.genes.bodyVertices.length - 1);
                if (this.genes.bodyVertices.length === 0) return;
            }
            const unscaledAttachmentVertex = this.genes.bodyVertices[wheelGene.vertexIndex];
            if (!unscaledAttachmentVertex) {
                return;
            }
            const scaledAttachmentVertex = {
                x: unscaledAttachmentVertex.x * this.genes.chassisScale,
                y: unscaledAttachmentVertex.y * this.genes.chassisScale
            };

            const radiusX = wheelGene.radius;
            const radiusY = radiusX * wheelGene.ovality;
            const ellipseVertices = this.generateEllipseVertices(radiusX, radiusY);

            const wheel = Bodies.fromVertices(
                x + scaledAttachmentVertex.x,
                y + scaledAttachmentVertex.y,
                [ellipseVertices],
                {
                    friction: 0.9,
                    density: 0.005,
                    restitution: 0.1,
                    render: { fillStyle: '#555' },
                    collisionFilter: {
                        category: CAR_CATEGORY,
                        mask: TERRAIN_CATEGORY,
                        group: CAR_COLLISION_GROUP
                    }
                },
                true
            );
            this.wheels.push(wheel);

            const constraint = Constraint.create({
                bodyA: this.chassis,
                bodyB: wheel,
                pointB: { x: 0, y: 0 },
                pointA: { x: scaledAttachmentVertex.x, y: scaledAttachmentVertex.y },
                stiffness: 0.8,
                damping: 0.1,
                length: 0
            });
            this.constraints.push(constraint);
        });

        this.matterBody = Composite.create({ bodies: [this.chassis, ...this.wheels], constraints: this.constraints });
        Composite.add(world, this.matterBody);

        if (this.chassis && this.chassis.position) {
            this.lastMaxDistanceCheck = (this.chassis.position.x || CAR_START_X) - CAR_START_X;
        } else {
            this.isAlive = false;
        }
    }

    update() {
        if (!this.isAlive || !this.chassis || !this.chassis.position || !this.chassis.velocity ||
            isNaN(this.chassis.position.x) || isNaN(this.chassis.position.y) ||
            isNaN(this.chassis.velocity.x) || isNaN(this.chassis.velocity.y) ||
            isNaN(this.chassis.angularVelocity) || isNaN(this.chassis.angle)
        ) {
            if (this.isAlive) console.log(`Car ${this.id} died: NaN detected. Pos: (${this.chassis?.position?.x?.toFixed(1)}, ${this.chassis?.position?.y?.toFixed(1)}), Vel: (${this.chassis?.velocity?.x?.toFixed(1)}, ${this.chassis?.velocity?.y?.toFixed(1)}), Angle: ${this.chassis?.angle?.toFixed(2)}`);
            this.isAlive = false;
            return;
        }

        let currentXPos = this.chassis.position.x;
        let currentFitness = currentXPos - CAR_START_X;

        if (currentFitness > this.maxDistance) {
            this.maxDistance = currentFitness;
        }

        if (this.maxDistance > this.lastMaxDistanceCheck + MIN_SIGNIFICANT_FORWARD_MOVE) {
            this.lastMaxDistanceCheck = this.maxDistance;
            this.framesSinceNoSignificantProgress = 0;
        } else {
            this.framesSinceNoSignificantProgress++;
        }

        this.wheels.forEach(wheel => {
            Body.setAngularVelocity(wheel, MOTOR_SPEED * (currentXPos < CAR_START_X + 50 ? 2.0 : 1));
        });

        const linearSpeed = Vector.magnitude(this.chassis.velocity);
        const angularSpeed = Math.abs(this.chassis.angularVelocity);

        if (linearSpeed < 0.02 && angularSpeed < 0.01) {
            this.framesAtExtremelyLowVelocity++;
        } else {
            this.framesAtExtremelyLowVelocity = 0;
        }

        const normalizedAngle = (this.chassis.angle % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI);
        const isTiltedSignificantly = (normalizedAngle > Math.PI * 0.4 && normalizedAngle < Math.PI * 1.6);

        if (isTiltedSignificantly && linearSpeed < 0.1 && angularSpeed < 0.05) {
            this.framesTiltedAndSlow++;
        } else {
            this.framesTiltedAndSlow = 0;
        }


        if (this.framesSinceNoSignificantProgress > NO_SIGNIFICANT_PROGRESS_FRAMES) {
            if (this.isAlive) console.log(`Car ${this.id} died: No significant progress for ${this.framesSinceNoSignificantProgress} frames. MaxDist: ${this.maxDistance.toFixed(1)}`);
            this.isAlive = false;
        }
        if (this.framesAtExtremelyLowVelocity > EXTREME_LOW_VELOCITY_FRAMES) {
            if (this.isAlive) console.log(`Car ${this.id} died: Extremely low velocity for ${this.framesAtExtremelyLowVelocity} frames. MaxDist: ${this.maxDistance.toFixed(1)}`);
            this.isAlive = false;
        }
        if (this.framesTiltedAndSlow > TILTED_AND_SLOW_FRAMES) {
            if (this.isAlive) console.log(`Car ${this.id} died: Tilted and slow for ${this.framesTiltedAndSlow} frames. Angle: ${this.chassis.angle.toFixed(2)} MaxDist: ${this.maxDistance.toFixed(1)}`);
            this.isAlive = false;
        }


        if (this.chassis.position.y > TERRAIN_START_Y + 650 || this.chassis.position.x < CAR_START_X - 600) {
            if (this.isAlive) console.log(`Car ${this.id} died: Fell off world. Pos: (${this.chassis.position.x.toFixed(1)}, ${this.chassis.position.y.toFixed(1)})`);
            this.isAlive = false;
        }
    }

    removeFromWorld() {
        if (this.matterBody) {
            Composite.remove(world, this.matterBody, true);
            this.matterBody = null;
            this.chassis = null;
            this.wheels = [];
            this.constraints = [];
        }
    }
}

function initializePopulation() {
    usedNames.clear();                     // обнуляем Set
    population = [];
    const popSize = parseInt(populationSizeInput.value, 10);

    for (let i = 0; i < popSize; i++) {
        population.push(new Car(null, generateUniqueCarName()));
    }
}


function startGeneration() {
    if (simulationRunning) return;
    simulationRunning = true;
    startStopButtonEl.textContent = "Next generation";
    resetSimulationButtonEl.style.display = 'block';
    initialScreenContentEl.style.display = 'none';

    const currentComplexity = parseFloat(terrainComplexityInput.value);
    if (!world || currentComplexity !== lastUsedTerrainComplexity) {
        if (world) {
            if (terrainBodies.length > 0) {
                World.remove(world, terrainBodies);
                terrainBodies = [];
            }
        } else {
            setupMatterJs();
        }
        generateTerrain();
    }


    clearCarsFromWorld();

    generation++;
    generationNumberDisplay.textContent = generation;
    currentBestFitnessInGeneration = 0;
    bestCarInGeneration = null;
    visuallyLeadingCarForCamera = null;

    if (generation === 1 && population.length === 0) {
        initializePopulation();
    } else {
        evolvePopulation();
    }

    population.forEach((car, index) => {
        if (car.genes && car.genes.bodyVertices && car.genes.wheels) {
            const spawnXOffset = (index % 10) * 60;
            const spawnY = CAR_START_Y;
            car.createBody(CAR_START_X + spawnXOffset, spawnY);
            car.isAlive = car.chassis ? true : false;
            car.framesSinceNoSignificantProgress = 0;
            car.framesAtExtremelyLowVelocity = 0;
            car.framesTiltedAndSlow = 0;
            car.maxDistance = 0;
            car.lastMaxDistanceCheck = 0;
        } else {
            car.isAlive = false;
        }
    });
    activeCarsCountDisplay.textContent = population.filter(c => c.isAlive).length;

    updateCamera(null, true);
}

function endGeneration() {
    simulationRunning = false;
    startStopButtonEl.textContent = "Loading...";

    population.forEach(car => {
        if (car.isAlive && car.chassis && car.chassis.position) {
            let finalFitness = car.chassis.position.x - CAR_START_X;
            car.maxDistance = Math.max(car.maxDistance, finalFitness);
        }
        car.fitness = car.maxDistance;
    });

    population.sort((a, b) => b.maxDistance - a.maxDistance);

    if (population.length > 0 && population[0].maxDistance > overallBestFitness) {
        overallBestFitness = population[0].maxDistance;
    }
    if (population.length > 0) {
        currentBestFitnessInGeneration = population[0].maxDistance;
        bestCarInGeneration = population[0];
    } else {
        currentBestFitnessInGeneration = 0;
        bestCarInGeneration = null;
    }

    updateDisplays();

    if (autoNextGenCheckbox.checked && population.length > 0) {
        setTimeout(startGeneration, 2000);
    }
}

function selectParentViaTournament(pool) {
    if (!pool || pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    const tournamentSize = Math.max(2, Math.min(5, Math.floor(pool.length / 2)));
    let bestInTournament = null;
    let bestFitnessInTournament = -Infinity;

    for (let i = 0; i < tournamentSize; i++) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        const candidate = pool[randomIndex];
        if (candidate && typeof candidate.maxDistance === 'number' && candidate.maxDistance > bestFitnessInTournament) {
            bestInTournament = candidate;
            bestFitnessInTournament = candidate.maxDistance;
        }
    }
    return bestInTournament || pool[0];
}

function evolvePopulation() {
    const popSize = parseInt(populationSizeInput.value, 10);
    const mutationR = parseFloat(mutationRateInput.value);
    const elitismR = parseFloat(elitismRateInput.value);
    const breedingPerc = parseFloat(breedingPercentageInput.value);
    const algorithmType = algorithmTypeSelect.value;

    const newPopulation = [];

    population.sort((a, b) => b.maxDistance - a.maxDistance);

    /* === 1. ЭЛИТА ========================================== */
    const eliteCount = Math.floor(popSize * elitismR);
    for (let i = 0; i < eliteCount && i < population.length; i++) {
        if (population[i] && population[i].genes) {
            newPopulation.push(
                new Car(cloneGenes(population[i].genes), generateUniqueCarName())
            );
        }
    }

    /* === 2. ПУЛ ДЛЯ СКРЕЩИВАНИЯ ============================ */
    const breedingPoolCount = Math.max(1, Math.floor(population.length * breedingPerc));
    const breedingPool = population.slice(0, breedingPoolCount);
    if (breedingPool.length === 0 && population.length > 0) breedingPool.push(population[0]);

    /* === 3. СОЗДАЁМ ПОТОМКОВ =============================== */
    const numOffspring = popSize - newPopulation.length;
    for (let i = 0; i < numOffspring; i++) {

        let offspringGenes;

        if (algorithmType === 'standard') {
            // --- турнирное скрещивание 1-к-1 ---
            const parent1 = selectParentViaTournament(breedingPool);
            let parent2 = selectParentViaTournament(breedingPool);

            if (breedingPool.length > 1 && parent1) {
                let attempts = 0;
                while (parent2 === parent1 && attempts < breedingPool.length * 2) {
                    parent2 = selectParentViaTournament(breedingPool);
                    attempts++;
                }
            }

            if (parent1 && parent2 && parent1.genes && parent2.genes) {
                offspringGenes = crossover(parent1.genes, parent2.genes);
            } else {
                // резервная копия (не должно случиться, но пусть будет)
                const fallback = parent1?.genes || parent2?.genes || breedingPool[0]?.genes;
                offspringGenes = cloneGenes(fallback) || new Car(null, 'ErrorCar').generateRandomGenes();
            }

        } else { // === SHUFFLE ==================================
            if (breedingPool.length) {
                offspringGenes = { wheels: [] };

                const pick = () => breedingPool[Math.floor(Math.random() * breedingPool.length)].genes;

                const shapeParent = pick();
                offspringGenes.numBodyVertices = shapeParent.numBodyVertices;
                offspringGenes.bodyVertices = JSON.parse(JSON.stringify(shapeParent.bodyVertices));

                offspringGenes.chassisScale = pick().chassisScale;

                const wheelParent = pick();
                offspringGenes.numWheels = wheelParent.numWheels;

                for (let k = 0; k < offspringGenes.numWheels; k++) {
                    const donor = pick();
                    const wheelTemplate = donor.wheels?.[Math.floor(Math.random() * donor.wheels.length)];
                    offspringGenes.wheels.push({
                        vertexIndex: Math.floor(random(0, offspringGenes.numBodyVertices)),
                        radius: wheelTemplate?.radius ?? random(10, 20),
                        ovality: wheelTemplate?.ovality ?? random(0.5, 1.5)
                    });
                }
                if (offspringGenes.numWheels === 0) offspringGenes.wheels = [];

            } else {
                offspringGenes = new Car(null, 'ErrorCar').generateRandomGenes();
            }
        }

        offspringGenes = mutate(offspringGenes, mutationR);
        newPopulation.push(new Car(offspringGenes, generateUniqueCarName()));
    }

    population = newPopulation;
}


function cloneGenes(genes) {
    if (!genes) return null;
    return JSON.parse(JSON.stringify(genes));
}

function crossover(genes1, genes2) {
    if (!genes1 || !genes2 || !genes1.bodyVertices || !genes2.bodyVertices || !genes1.wheels || !genes2.wheels) {
        return cloneGenes(genes1 || genes2) || new Car(null, "ErrorCar").generateRandomGenes();
    }

    const newGenes = {
        bodyVertices: [],
        wheels: [],
        chassisScale: (Math.random() < 0.5) ? genes1.chassisScale : genes2.chassisScale
    };

    if (Math.random() < 0.5) {
        newGenes.numBodyVertices = genes1.numBodyVertices;
        newGenes.bodyVertices = JSON.parse(JSON.stringify(genes1.bodyVertices));
    } else {
        newGenes.numBodyVertices = genes2.numBodyVertices;
        newGenes.bodyVertices = JSON.parse(JSON.stringify(genes2.bodyVertices));
    }

    if (Math.random() < 0.5) {
        newGenes.numWheels = genes1.numWheels;
        newGenes.wheels = JSON.parse(JSON.stringify(genes1.wheels));
    } else {
        newGenes.numWheels = genes2.numWheels;
        newGenes.wheels = JSON.parse(JSON.stringify(genes2.wheels));
    }

    newGenes.wheels.forEach(wheel => {
        if (wheel.vertexIndex >= newGenes.numBodyVertices) {
            wheel.vertexIndex = Math.max(0, newGenes.numBodyVertices - 1);
        }
        if (typeof wheel.ovality === 'undefined') {
            wheel.ovality = 1.0;
        }
    });
    if (newGenes.numWheels === 0) {
        newGenes.wheels = [];
    }
    return newGenes;
}

function mutate(genes, rate) {
    if (!genes || !genes.bodyVertices || !genes.wheels || typeof genes.chassisScale === 'undefined') {
        return new Car(null, "ErrorCar").generateRandomGenes();
    }

    if (Math.random() < rate * 0.3) {
        genes.chassisScale += random(-0.25, 0.25);
        genes.chassisScale = Math.max(0.5, Math.min(2.0, genes.chassisScale));
    }

    if (Math.random() < rate * 0.1) {
        const oldNumVertices = genes.numBodyVertices;
        genes.numBodyVertices += (Math.random() < 0.5 ? -1 : 1);
        genes.numBodyVertices = Math.max(3, Math.min(8, genes.numBodyVertices));

        if (genes.numBodyVertices !== oldNumVertices) {
            const newBodyV = [];
            const angleStep = (2 * Math.PI) / genes.numBodyVertices;
            const baseBodyRadius = random(25, 45);
            for (let k = 0; k < genes.numBodyVertices; k++) {
                const r = baseBodyRadius + random(-10, 10);
                newBodyV.push({ x: r * Math.cos(k * angleStep + random(-0.2, 0.2)), y: r * Math.sin(k * angleStep + random(-0.2, 0.2)) });
            }
            newBodyV.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
            genes.bodyVertices = newBodyV;
            genes.wheels.forEach(w => { w.vertexIndex = Math.min(w.vertexIndex, Math.max(0, genes.numBodyVertices - 1)); });
        }
    }

    genes.bodyVertices.forEach(v => {
        if (Math.random() < rate) v.x += random(-5, 5);
        if (Math.random() < rate) v.y += random(-5, 5);
    });
    genes.bodyVertices.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));

    if (Math.random() < rate * 0.1) {
        const oldNumWheels = genes.numWheels;
        genes.numWheels += (Math.random() < 0.5 ? -1 : 1);
        genes.numWheels = Math.max(0, Math.min(4, genes.numWheels));

        if (genes.numWheels > oldNumWheels) {
            for (let k = 0; k < genes.numWheels - oldNumWheels; k++) {
                genes.wheels.push({
                    vertexIndex: Math.floor(random(0, genes.numBodyVertices)),
                    radius: random(10, 20),
                    ovality: random(0.5, 1.5)
                });
            }
        } else if (genes.numWheels < oldNumWheels) {
            genes.wheels = genes.wheels.slice(0, genes.numWheels);
        }
    }

    genes.wheels.forEach(wheel => {
        if (Math.random() < rate) {
            wheel.radius = Math.max(3, wheel.radius + random(-3, 3));
        }
        if (Math.random() < rate) {
            wheel.vertexIndex = Math.floor(random(0, Math.max(1, genes.numBodyVertices)));
        }
        if (Math.random() < rate) {
            wheel.ovality += random(-0.2, 0.2);
            wheel.ovality = Math.max(0.3, Math.min(2.0, wheel.ovality));
        }
    });

    return genes;
}

function clearCarsFromWorld() {
    population.forEach(car => car.removeFromWorld());
}

function updateCamera(carToFollow, forceStatic = false) {
    if (!render || !render.options || !render.bounds) {
        return;
    }

    if (isDraggingCamera && !forceStatic) {
        return;
    }

    if (forceStatic) {
        Bounds.translate(render.bounds, Vector.create(-render.bounds.min.x, -render.bounds.min.y));
        return;
    }

    if (!isFollowLeaderActive) {
        return;
    }

    if (carToFollow && carToFollow.isAlive && carToFollow.chassis && carToFollow.chassis.position) {
        const target = carToFollow.chassis;
        const viewWidth = render.options.width;
        const viewHeight = render.options.height;

        const desiredMinX = target.position.x - viewWidth / 2;
        const desiredMinY = target.position.y - viewHeight / 2;

        const lerpFactor = 0.08;
        const currentMinX = render.bounds.min.x;
        const currentMinY = render.bounds.min.y;

        const deltaX = (desiredMinX - currentMinX) * lerpFactor;
        const deltaY = (desiredMinY - currentMinY) * lerpFactor;

        Bounds.translate(render.bounds, Vector.create(deltaX, deltaY));
    }
}

function updateDisplays() {
    const curBest = Number(currentBestFitnessInGeneration);
    const ovrBest = Number(overallBestFitness);

    currentBestDistanceDisplay.textContent = !isNaN(curBest) ? curBest.toFixed(1) : '0';
    overallBestDistanceDisplay.textContent = !isNaN(ovrBest) ? ovrBest.toFixed(1) : '0';
}

function fullResetSimulation() {
    if (runner) Runner.stop(runner);
    if (render) Render.stop(render);
    if (engine) {
        World.clear(engine.world, false);
        Composite.clear(engine.world, false);
        Engine.clear(engine);
    }

    engine = null;
    render = null;
    runner = null;
    world = null;

    terrainBodies = [];
    population = [];
    generation = 0;
    overallBestFitness = 0;
    currentBestFitnessInGeneration = 0;
    bestCarInGeneration = null;
    visuallyLeadingCarForCamera = null;
    simulationRunning = false;

    startStopButtonEl.textContent = "Start";
    startStopButtonEl.disabled = false;
    resetSimulationButtonEl.style.display = 'none';
    initialScreenContentEl.style.display = 'block';

    updateDisplays();
    activeCarsCountDisplay.textContent = "0";
    generationNumberDisplay.textContent = "0";

    isFollowLeaderActive = true;
    followLeaderButtonEl.classList.add('active');
    autoNextGenCheckbox.checked = true;

    console.log("Симуляция сброшена.");
}


startStopButtonEl.addEventListener('click', () => {
    if (simulationRunning) {
        endGeneration();
    } else {
        if (!world) {
            try {
                initialScreenContentEl.style.display = 'none';
                setupMatterJs();
                generateTerrain();
                resetSimulationButtonEl.style.display = 'block';
            } catch (error) {
                console.error("Ошибка при первоначальной настройке:", error);
                alert("Ошибка инициализации симуляции: " + error.message);
                startStopButtonEl.disabled = false;
                startStopButtonEl.textContent = "Start";
                resetSimulationButtonEl.style.display = 'none';
                initialScreenContentEl.style.display = 'block';
                return;
            }
        } else {
            const currentComplexity = parseFloat(terrainComplexityInput.value);
            if (currentComplexity !== lastUsedTerrainComplexity) {
                console.log("Сложность рельефа изменена. Перегенерация рельефа для следующего поколения...");
                generateTerrain();
            }
        }
        const popSize = parseInt(populationSizeInput.value);

        if (popSize < 5 || popSize > 200) {
            alert("Размер популяции должен быть между 5 и 200."); return;
        }
        startGeneration();
    }
});

resetSimulationButtonEl.addEventListener('click', () => {
    confirmResetModalEl.style.display = 'flex';
});

confirmResetYesButton.addEventListener('click', () => {
    confirmResetModalEl.style.display = 'none';
    fullResetSimulation();
});

followLeaderButtonEl.addEventListener('click', () => {
    isFollowLeaderActive = !isFollowLeaderActive;
    followLeaderButtonEl.classList.toggle('active', isFollowLeaderActive);
    if (!isFollowLeaderActive && !isDraggingCamera) {
        updateCamera(null, true);
    }
});

aboutProjectButtonEl.addEventListener('click', () => {
    aboutProjectModalEl.style.display = 'flex';
});

populationSizeInput.addEventListener('input', (e) => {
    populationSizeSlider.value = e.target.value;
});
populationSizeSlider.addEventListener('input', (e) => {
    populationSizeInput.value = e.target.value;
});

terrainComplexityInput.addEventListener('input', (e) => {
    terrainComplexityValue.textContent = parseFloat(e.target.value).toFixed(2);
});


mutationRateInput.addEventListener('input', (e) => mutationRateValue.textContent = parseFloat(e.target.value).toFixed(2));
elitismRateInput.addEventListener('input', (e) => elitismRateValue.textContent = parseFloat(e.target.value).toFixed(2));
breedingPercentageInput.addEventListener('input', (e) => breedingPercentageValue.textContent = parseFloat(e.target.value).toFixed(2));

algorithmTypeSelect.addEventListener('change', (e) => {
    algorithmDescriptionEl.textContent = algorithmDescriptions[e.target.value];
});

window.addEventListener('resize', () => {
    if (render && simulationContainerEl.clientWidth > 0 && simulationContainerEl.clientHeight > 0) {
        let newWidth = simulationContainerEl.clientWidth;
        let newHeight = simulationContainerEl.clientHeight;


        if (canvasEl.width !== newWidth || canvasEl.height !== newHeight) {
            Render.setPixelRatio(render, window.devicePixelRatio);
            render.options.width = newWidth;
            render.options.height = newHeight;
            canvasEl.width = newWidth;
            canvasEl.height = newHeight;
            updateCamera(null, true);
        }
    }
});

// Initial UI setup
mutationRateValue.textContent = parseFloat(mutationRateInput.value).toFixed(2);
elitismRateValue.textContent = parseFloat(elitismRateInput.value).toFixed(2);
breedingPercentageValue.textContent = parseFloat(breedingPercentageInput.value).toFixed(2);
terrainComplexityValue.textContent = parseFloat(terrainComplexityInput.value).toFixed(2);
autoNextGenCheckbox.checked = true;
followLeaderButtonEl.classList.add('active');
algorithmDescriptionEl.textContent = algorithmDescriptions[algorithmTypeSelect.value];

console.log("Симуляция 'MutantMotors' готова к запуску. Нажмите 'Старт'.");