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