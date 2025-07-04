interface BambooProps {
    bamboo: {
        minHeight: number,
        maxHeight: number,
        windSpeed: number,
        windScale: number,
        bend: number,
    },
    knot: {
        minHeight: number,
        maxHeight: number
    },
    leaves: {
        count: number,
        windSpeed: number,
        windScale: number
    },
    shader: {
        near: number,
        far: number
    }
}

interface BambooSpecFull {
    rng: () => number,
    bamboo: {
        windSpeed: number,
        windScale: number,
    },
    knots: {
        uResolution: number,
        vResolution: number,
        stemCount: number,
        minHeight: number,
        maxHeight: number
    },
    stems: {
        windSpeed: number,
        windScale: number,
        uResolution: number,
        vResolution: number,
        leafCount: number,
        secondaryStemChance: number
    },
    shader: {
        near: number,
        far: number
    }
}