import { FC } from "react";
import Link from "next/link";

const Test: FC = () => {
    return (
        <div className={"w-full h-screen flex items-center justify-center bg-neutral-200"}>
            <Link href={"/"} className={"text-6xl"}>
                <h1 className={"text-[10rem]"}>Haha, </h1>this is a test page to see if <br /> canvas unloading works properly
            </Link>
        </div>
    )
}

export default Test