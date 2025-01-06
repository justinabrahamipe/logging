import { Card } from "flowbite-react";

export default function Home() {
  const cardList = [
    {
      title: "Activities",
      link: "/activities",
    },
    {
      title: "Logs",
      link: "/log",
    },
  ];
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start w-full h-full">
        <div className="flex flex-row justify-around gap-8 flex-wrap w-full h-full ">
          {cardList.map((i) => (
            <Card
              className="flex align-middle justify-center w-2/5 h-full"
              key={i.title}
              href={i.link}
            >
              <h5 className="text-7xl  tracking-tight text-gray-900 dark:text-white text-center">
                {i.title}
              </h5>
            </Card>
          ))}
        </div>
        <div></div>
      </main>
    </div>
  );
}
