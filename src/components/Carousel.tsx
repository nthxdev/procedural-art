import { useState } from "react";
type Slide = {
  title: string;
  description: string;
};

type CarouselProps = {
  slides: Slide[];
};

export default function Carousel({ slides }: CarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  function nextSlide() {
    setActiveIndex((index) => (index + 1) % slides.length);
  }

  function previousSlide() {
    setActiveIndex(
      (index) => (index - 1 + slides.length) % slides.length
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">

      {/* Visible window */}
      <div className="overflow-hidden rounded-xl">

        {/* Slides track */}
        <div
          className="flex transition-transform duration-500"
          style={{
            transform: `translateX(-${activeIndex * 100}%)`,
          }}
        >
          {slides.map((slide) => (
            <div
              key={slide.title}
              className="w-full shrink-0 bg-slate-800 p-12 text-white"
            >
              <h2 className="text-2xl font-bold">
                {slide.title}
              </h2>

              <p>{slide.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-4">
        <button onClick={previousSlide}>
          Previous
        </button>

        <button onClick={nextSlide}>
          Next
        </button>
      </div>

      {/* Indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {slides.map((slide, index) => (
          <button
            key={slide.title}
            onClick={() => setActiveIndex(index)}
            className={`h-3 w-3 rounded-full ${
              activeIndex === index
                ? "bg-blue-500"
                : "bg-gray-300"
            }`}
          />
        ))}
      </div>

    </div>
  );
}