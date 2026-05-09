export interface StoryChunkData {
  id: string;
  text: string;
}

export interface StoryParagraphData {
  id: string;
  chunks: StoryChunkData[];
}

export interface StructuredStoryData {
  title: string;
  paragraphs: StoryParagraphData[];
}

export const structuredStory: StructuredStoryData = {
  title: "The Golden Trophy",
  paragraphs: [
    {
      id: "para_1",
      chunks: [
        {
          id: "para_1_chunk_1",
          text: "Leo stared at the gleaming trophy on Mr. Miller’s desk. Earlier, during the difficult math final, he had glimpsed Sarah’s answers. Those stolen glances secured his perfect score, but the heavy weight in his chest [c] felt like lead. His classmates cheered for his success, yet Leo could not meet their eyes. The gold plastic felt cold and unearned [c] in his trembling hands. Every congratulatory pat on the back [c] felt like a sharp sting of guilt. He realized that [c] a prize won through deception was not a victory, but a constant, quiet burden [c] he would have to carry.",
        },
      ],
    },
    {
      id: "para_2",
      chunks: [
        {
          id: "para_2_chunk_1",
          text: "Taking a deep breath, Leo walked into the quiet classroom [c] after school. He placed the trophy back on the mahogany desk [c] and confessed his choice to Mr. Miller. The teacher listened patiently, his expression soft but firm. Although Leo lost the award [c] and faced a weekend of detention, the crushing pressure in his heart finally vanished. He walked home [c] with his head held high, understanding that truth was more valuable than any plastic prize.",
        },
      ],
    },
    {
      id: "para_3",
      chunks: [
        {
          id: "para_3_chunk_1",
          text: "Honesty had cost him a trophy, but it had restored his integrity, which was a far greater reward in the end.",
        },
      ],
    },
  ],
};

export function structuredStoryToText(story: StructuredStoryData): string {
  return story.paragraphs
    .map((paragraph) => paragraph.chunks.map((chunk) => chunk.text.trim()).join(" "))
    .join("\n\n");
}
