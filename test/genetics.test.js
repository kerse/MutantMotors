import assert from 'node:assert/strict';
import test from 'node:test';
import {
    cloneGenes,
    createShuffleOffspring,
    crossover,
    generateRandomGenes,
    mutate,
    selectParentViaTournament
} from '../src/genetics.js';

function sampleGenes(overrides = {}) {
    return {
        numBodyVertices: 4,
        bodyVertices: [
            { x: -10, y: -10 },
            { x: 10, y: -10 },
            { x: 10, y: 10 },
            { x: -10, y: 10 }
        ],
        numWheels: 2,
        wheels: [
            { vertexIndex: 0, radius: 12, ovality: 1 },
            { vertexIndex: 2, radius: 14, ovality: 1.2 }
        ],
        chassisScale: 1,
        ...overrides
    };
}

test('generateRandomGenes keeps genes inside supported ranges', () => {
    for (let i = 0; i < 100; i++) {
        const genes = generateRandomGenes();

        assert.ok(genes.numBodyVertices >= 3);
        assert.ok(genes.numBodyVertices <= 8);
        assert.equal(genes.bodyVertices.length, genes.numBodyVertices);
        assert.ok(genes.numWheels >= 0);
        assert.ok(genes.numWheels <= 4);
        assert.equal(genes.wheels.length, genes.numWheels);
        assert.ok(genes.chassisScale >= 0.7);
        assert.ok(genes.chassisScale <= 1.5);

        for (const wheel of genes.wheels) {
            assert.ok(wheel.vertexIndex >= 0);
            assert.ok(wheel.vertexIndex < genes.numBodyVertices);
            assert.ok(wheel.radius >= 10);
            assert.ok(wheel.radius <= 20);
            assert.ok(wheel.ovality >= 0.5);
            assert.ok(wheel.ovality <= 1.5);
        }
    }
});

test('cloneGenes returns a deep copy', () => {
    const original = sampleGenes();
    const clone = cloneGenes(original);

    clone.bodyVertices[0].x = 999;
    clone.wheels[0].radius = 999;

    assert.equal(original.bodyVertices[0].x, -10);
    assert.equal(original.wheels[0].radius, 12);
});

test('selectParentViaTournament returns the fittest sampled candidate', () => {
    const pool = [
        { id: 'slow', maxDistance: 5 },
        { id: 'medium', maxDistance: 20 },
        { id: 'fast', maxDistance: 50 },
        { id: 'ignored', maxDistance: 100 }
    ];
    const rolls = [0.01, 0.51];
    const rng = () => rolls.shift();

    assert.equal(selectParentViaTournament(pool, rng).id, 'fast');
});

test('crossover deep-clones selected parent genes and normalizes wheel vertex indexes', () => {
    const parentA = sampleGenes();
    const parentB = sampleGenes({
        numBodyVertices: 3,
        bodyVertices: [
            { x: 0, y: -10 },
            { x: 10, y: 10 },
            { x: -10, y: 10 }
        ],
        wheels: [{ vertexIndex: 10, radius: 16 }],
        numWheels: 1,
        chassisScale: 1.5
    });
    const rng = () => 0.75;

    const child = crossover(parentA, parentB, rng);
    child.bodyVertices[0].x = 999;
    child.wheels[0].radius = 999;

    assert.equal(child.numBodyVertices, 3);
    assert.equal(child.wheels[0].vertexIndex, 2);
    assert.equal(child.wheels[0].ovality, 1);
    assert.equal(parentB.bodyVertices[0].x, 0);
    assert.equal(parentB.wheels[0].radius, 16);
});

test('mutate with zero rate preserves valid genes', () => {
    const genes = sampleGenes();
    const before = cloneGenes(genes);

    assert.deepEqual(mutate(genes, 0), before);
});

test('mutate clamps changed values to safe supported ranges', () => {
    const genes = sampleGenes({
        chassisScale: 1.9,
        wheels: [{ vertexIndex: 0, radius: 4, ovality: 1.95 }],
        numWheels: 1
    });
    const rng = () => 0;

    const mutated = mutate(genes, 1, rng);

    assert.ok(mutated.chassisScale >= 0.5);
    assert.ok(mutated.chassisScale <= 2);
    assert.ok(mutated.numBodyVertices >= 3);
    assert.ok(mutated.numBodyVertices <= 8);
    assert.ok(mutated.numWheels >= 0);
    assert.ok(mutated.numWheels <= 4);
    for (const wheel of mutated.wheels) {
        assert.ok(wheel.radius >= 3);
        assert.ok(wheel.ovality >= 0.3);
        assert.ok(wheel.ovality <= 2);
        assert.ok(wheel.vertexIndex >= 0);
        assert.ok(wheel.vertexIndex < mutated.numBodyVertices);
    }
});

test('createShuffleOffspring combines genes from the breeding pool without mutating parents', () => {
    const parentA = { genes: sampleGenes({ chassisScale: 0.8 }) };
    const parentB = {
        genes: sampleGenes({
            numBodyVertices: 3,
            bodyVertices: [
                { x: 0, y: -10 },
                { x: 10, y: 10 },
                { x: -10, y: 10 }
            ],
            numWheels: 1,
            wheels: [{ vertexIndex: 1, radius: 18, ovality: 1.4 }],
            chassisScale: 1.4
        })
    };
    const before = cloneGenes(parentB.genes);
    const rng = () => 0.75;

    const child = createShuffleOffspring([parentA, parentB], rng);
    child.bodyVertices[0].x = 999;
    child.wheels[0].radius = 999;

    assert.equal(child.numBodyVertices, 3);
    assert.equal(child.numWheels, 1);
    assert.deepEqual(parentB.genes, before);
});
