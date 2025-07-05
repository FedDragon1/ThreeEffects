import { FC } from "react";
import Bamboo from "@/components/Bamboo";

const spec: Omit<BambooSpec, "rng"> = {
    bamboo: {
        windScale: 12,
        windSpeed: 0.3,
        minHeight: 0.5,
        maxHeight: 3
    },
    knots: {
        uResolution: 8,
        vResolution: 8,
        stemCount: 20,
        minHeight: 0.15,
        maxHeight: 0.35
    },
    stems: {
        windSpeed: 0.05,
        windScale: 0.2,
        uResolution: 10,
        vResolution: 3,
        leafCount: 5,
        primaryStemChance: 0.5,
        secondaryStemChance: 0.3
    },
    shader: {
        near: 5,
        far: 10
    }
}

const BambooPage: FC = () => {
    return (
        <div className={"relative w-screen h-screen flex justify-center items-center"}>
            <Bamboo bamboo={spec.bamboo} knots={spec.knots} stems={spec.stems} shader={spec.shader}/>
        </div>
    )
}

export default BambooPage