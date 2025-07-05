interface BambooSpec {
    rng: () => number,
    bamboo: {
        windSpeed: number,
        windScale: number,
        minHeight: number,
        maxHeight: number,
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
        primaryStemChance: number,
        secondaryStemChance: number
    },
    shader: {
        near: number,
        far: number
    }
}