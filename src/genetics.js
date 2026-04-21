export function random(min, max, rng = Math.random) {
    return rng() * (max - min) + min;
}

export function cloneGenes(genes) {
    if (!genes) return null;
    return JSON.parse(JSON.stringify(genes));
}

export function generateRandomGenes(rng = Math.random) {
    const numBodyVert = Math.floor(random(3, 8.99, rng));
    const bodyVertices = [];
    const angleStep = (2 * Math.PI) / numBodyVert;
    const baseBodyRadius = random(25, 45, rng);

    for (let i = 0; i < numBodyVert; i++) {
        const radius = baseBodyRadius + random(-10, 10, rng);
        bodyVertices.push({
            x: radius * Math.cos(i * angleStep + random(-0.2, 0.2, rng)),
            y: radius * Math.sin(i * angleStep + random(-0.2, 0.2, rng))
        });
    }

    bodyVertices.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));

    const numWh = Math.floor(random(0, 4.99, rng));
    const wheelGenes = [];
    for (let i = 0; i < numWh; i++) {
        wheelGenes.push({
            vertexIndex: Math.floor(random(0, numBodyVert, rng)),
            radius: random(10, 20, rng),
            ovality: random(0.5, 1.5, rng)
        });
    }

    return {
        numBodyVertices: numBodyVert,
        bodyVertices,
        numWheels: numWh,
        wheels: wheelGenes,
        chassisScale: random(0.7, 1.5, rng)
    };
}

export function selectParentViaTournament(pool, rng = Math.random) {
    if (!pool || pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    const tournamentSize = Math.max(2, Math.min(5, Math.floor(pool.length / 2)));
    let bestInTournament = null;
    let bestFitnessInTournament = -Infinity;

    for (let i = 0; i < tournamentSize; i++) {
        const randomIndex = Math.floor(rng() * pool.length);
        const candidate = pool[randomIndex];
        if (candidate && typeof candidate.maxDistance === 'number' && candidate.maxDistance > bestFitnessInTournament) {
            bestInTournament = candidate;
            bestFitnessInTournament = candidate.maxDistance;
        }
    }

    return bestInTournament || pool[0];
}

export function crossover(genes1, genes2, rng = Math.random) {
    if (!genes1 || !genes2 || !genes1.bodyVertices || !genes2.bodyVertices || !genes1.wheels || !genes2.wheels) {
        return cloneGenes(genes1 || genes2) || generateRandomGenes(rng);
    }

    const newGenes = {
        bodyVertices: [],
        wheels: [],
        chassisScale: (rng() < 0.5) ? genes1.chassisScale : genes2.chassisScale
    };

    if (rng() < 0.5) {
        newGenes.numBodyVertices = genes1.numBodyVertices;
        newGenes.bodyVertices = cloneGenes(genes1.bodyVertices);
    } else {
        newGenes.numBodyVertices = genes2.numBodyVertices;
        newGenes.bodyVertices = cloneGenes(genes2.bodyVertices);
    }

    if (rng() < 0.5) {
        newGenes.numWheels = genes1.numWheels;
        newGenes.wheels = cloneGenes(genes1.wheels);
    } else {
        newGenes.numWheels = genes2.numWheels;
        newGenes.wheels = cloneGenes(genes2.wheels);
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

export function mutate(genes, rate, rng = Math.random) {
    if (!genes || !genes.bodyVertices || !genes.wheels || typeof genes.chassisScale === 'undefined') {
        return generateRandomGenes(rng);
    }

    if (rng() < rate * 0.3) {
        genes.chassisScale += random(-0.25, 0.25, rng);
        genes.chassisScale = Math.max(0.5, Math.min(2.0, genes.chassisScale));
    }

    if (rng() < rate * 0.1) {
        const oldNumVertices = genes.numBodyVertices;
        genes.numBodyVertices += (rng() < 0.5 ? -1 : 1);
        genes.numBodyVertices = Math.max(3, Math.min(8, genes.numBodyVertices));

        if (genes.numBodyVertices !== oldNumVertices) {
            const newBodyV = [];
            const angleStep = (2 * Math.PI) / genes.numBodyVertices;
            const baseBodyRadius = random(25, 45, rng);
            for (let k = 0; k < genes.numBodyVertices; k++) {
                const r = baseBodyRadius + random(-10, 10, rng);
                newBodyV.push({
                    x: r * Math.cos(k * angleStep + random(-0.2, 0.2, rng)),
                    y: r * Math.sin(k * angleStep + random(-0.2, 0.2, rng))
                });
            }
            newBodyV.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
            genes.bodyVertices = newBodyV;
            genes.wheels.forEach(w => {
                w.vertexIndex = Math.min(w.vertexIndex, Math.max(0, genes.numBodyVertices - 1));
            });
        }
    }

    genes.bodyVertices.forEach(v => {
        if (rng() < rate) v.x += random(-5, 5, rng);
        if (rng() < rate) v.y += random(-5, 5, rng);
    });
    genes.bodyVertices.sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));

    if (rng() < rate * 0.1) {
        const oldNumWheels = genes.numWheels;
        genes.numWheels += (rng() < 0.5 ? -1 : 1);
        genes.numWheels = Math.max(0, Math.min(4, genes.numWheels));

        if (genes.numWheels > oldNumWheels) {
            for (let k = 0; k < genes.numWheels - oldNumWheels; k++) {
                genes.wheels.push({
                    vertexIndex: Math.floor(random(0, genes.numBodyVertices, rng)),
                    radius: random(10, 20, rng),
                    ovality: random(0.5, 1.5, rng)
                });
            }
        } else if (genes.numWheels < oldNumWheels) {
            genes.wheels = genes.wheels.slice(0, genes.numWheels);
        }
    }

    genes.wheels.forEach(wheel => {
        if (rng() < rate) {
            wheel.radius = Math.max(3, wheel.radius + random(-3, 3, rng));
        }
        if (rng() < rate) {
            wheel.vertexIndex = Math.floor(random(0, Math.max(1, genes.numBodyVertices), rng));
        }
        if (rng() < rate) {
            wheel.ovality += random(-0.2, 0.2, rng);
            wheel.ovality = Math.max(0.3, Math.min(2.0, wheel.ovality));
        }
    });

    return genes;
}

export function createShuffleOffspring(breedingPool, rng = Math.random) {
    if (!breedingPool.length) {
        return generateRandomGenes(rng);
    }

    const offspringGenes = { wheels: [] };
    const pick = () => breedingPool[Math.floor(rng() * breedingPool.length)].genes;

    const shapeParent = pick();
    offspringGenes.numBodyVertices = shapeParent.numBodyVertices;
    offspringGenes.bodyVertices = cloneGenes(shapeParent.bodyVertices);

    offspringGenes.chassisScale = pick().chassisScale;

    const wheelParent = pick();
    offspringGenes.numWheels = wheelParent.numWheels;

    for (let k = 0; k < offspringGenes.numWheels; k++) {
        const donor = pick();
        const wheelTemplate = donor.wheels?.[Math.floor(rng() * donor.wheels.length)];
        offspringGenes.wheels.push({
            vertexIndex: Math.floor(random(0, offspringGenes.numBodyVertices, rng)),
            radius: wheelTemplate?.radius ?? random(10, 20, rng),
            ovality: wheelTemplate?.ovality ?? random(0.5, 1.5, rng)
        });
    }

    if (offspringGenes.numWheels === 0) offspringGenes.wheels = [];
    return offspringGenes;
}
