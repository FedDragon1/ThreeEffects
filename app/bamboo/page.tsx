import { FC } from "react";
import Bamboo from "@/components/Bamboo";

const BambooPage: FC = () => {
    return (
        <div className={"relative w-screen h-screen flex justify-center items-center"}>
            <Bamboo />
        </div>
    )
}

export default BambooPage