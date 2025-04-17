import Flower from "@/components/Flower";

export default function Home() {
    return (
        <div className={"w-screen h-screen relative bg-stone-300"}>
            <div className={"w-full h-full fixed top-0 flex items-center justify-center"}>
                <Flower className={"flex-grow max-w-[100vh] anim-show"}></Flower>
            </div>
            <div className={"w-full h-full flex flex-col justify-between px-10 py-12 z-10"}>
                <div className={"w-full flex justify-between"}>
                    <div className={"flex gap-16 items-center anim-b"}>
                        <h1 className={"text-4xl"}>Fe</h1>
                        <span className={"text-neutral-700 text-sm"}>Created by<br />FedDragon</span>
                    </div>
                    <div className={"flex gap-10 items-center anim-b opacity-0 ![animation-delay:100ms]"}>
                        <span>Works</span>
                        <span>Contact</span>
                        <div className={"bg-neutral-900 rounded-full flex items-center gap-2 p-2"}>
                            <span className={"text-neutral-100 pl-2"}>Learn More</span>
                            <div className={"flex p-2 rounded-full bg-neutral-100 items-center justify-center size-8"}>
                                <span className={"text-xl"}>&gt;</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className={"flex flex-col gap-16"}>
                    <div className={"flex flex-col gap-2"}>
                        <h1 className={"text-[5.5rem] leading-[5.5rem] anim-r opacity-0 ![animation-delay:200ms]"}>Creativity-Driven</h1>
                        <h1 className={"text-[5.5rem] leading-[5.5rem] anim-r opacity-0 ![animation-delay:300ms]"}>Multidisciplinary Lab</h1>
                    </div>
                    <div className={"flex justify-between items-center"}>
                        <div className={"flex gap-12 items-stretch anim-b opacity-0 ![animation-delay:200ms]"}>
                            <div className={"flex flex-col justify-center items-start border px-6 self-stretch"}>
                                <span>No.</span>
                                <span>001</span>
                            </div>
                            <div className={"flex flex-col gap-2 h-full"}>
                                <span>X / Twitter</span>
                                <span>Github</span>
                                <span>Discord</span>
                            </div>
                            <div className={"flex flex-col gap-2 h-full pl-8"}>
                                <span>RED</span>
                                <span>Experience</span>
                                <span>Get In Touch</span>
                            </div>
                        </div>
                        <div className={"anim-b opacity-0 ![animation-delay:300ms]"}>
                            2025 FedDragon<br/>
                            Inspired by D3adRabbit
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
