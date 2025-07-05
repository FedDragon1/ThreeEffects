import { FC, ReactNode } from "react";
import Link from "next/link";

interface DemoFrameProps {
    children: ReactNode;
    index: number
}

function zfill(input: any, width: number) {
    const str = String(input);
    // If the string is already >= width, padStart does nothing.
    return str.padStart(width, '0');
}

const Pointer: FC<{ children: ReactNode, className?: string }> = ({ children, className }) => {
    return (
        <div className={`cursor-pointer ${className}`}>
            {children}
        </div>
    )
}

const DemoFrame: FC<DemoFrameProps> = ({ children, index }) => {
    return (
        <div className={"w-screen h-screen relative bg-stone-300 isolate"}>
            <div className={"w-full h-full fixed top-0 flex items-center justify-center z-0"}>
                {children}
            </div>
            <div className={"w-full h-full flex flex-col justify-between px-10 py-12 z-10"}>
                <div className={"w-full flex justify-between"}>
                    <div className={"flex gap-16 items-center anim-b"}>
                        <Pointer className={"text-4xl"}>Fe</Pointer>
                        <span className={"text-neutral-700 text-sm"}>Created by<br/>FedDragon</span>
                    </div>
                    <div className={"flex gap-10 items-center anim-b opacity-0 ![animation-delay:100ms]"}>
                        <Pointer>Works</Pointer>
                        <Pointer>Contact</Pointer>
                        <Link href={"/test"}
                              className={"bg-neutral-900 rounded-full flex items-center gap-2 p-2 cursor-pointer"}>
                            <span className={"text-neutral-100 pl-2"}>Learn More</span>
                            <div className={"flex p-2 rounded-full bg-neutral-100 items-center justify-center size-8"}>
                                <span className={"text-xl"}>&gt;</span>
                            </div>
                        </Link>
                    </div>
                </div>
                <div className={"flex flex-col gap-16"}>
                    <div className={"flex flex-col gap-2"}>
                        <h1 className={"text-[5.5rem] leading-[5.5rem] anim-r opacity-0 ![animation-delay:200ms] mix-blend-difference text-white"}>Creativity-Driven</h1>
                        <h1 className={"text-[5.5rem] leading-[5.5rem] anim-r opacity-0 ![animation-delay:300ms] mix-blend-difference text-white"}>Multidisciplinary
                            Lab</h1>
                    </div>
                    <div className={"flex justify-between items-center"}>
                        <div className={"flex gap-12 items-stretch anim-b opacity-0 ![animation-delay:200ms]"}>
                            <div className={"flex flex-col justify-center items-start border px-6 self-stretch"}>
                                <span>No.</span>
                                <span>{zfill(index, 3)}</span>
                            </div>
                            <div className={"flex flex-col gap-2 h-full"}>
                                <Pointer>X / Twitter</Pointer>
                                <Pointer>Github</Pointer>
                                <Pointer>Discord</Pointer>
                            </div>
                            <div className={"flex flex-col gap-2 h-full pl-8"}>
                                <Pointer>RED</Pointer>
                                <Pointer>Experience</Pointer>
                                <Pointer>Get In Touch</Pointer>
                            </div>
                        </div>
                        <div className={"anim-b opacity-0 ![animation-delay:300ms]"}>
                            2025 FedDragon<br/>
                            Layout by D3adRabbit
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DemoFrame