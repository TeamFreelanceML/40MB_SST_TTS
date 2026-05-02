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
  title: "The Little Boat",
  paragraphs: [
    {
      id: "para_1",
      chunks: [
        {
          id: "para_1_chunk_1",
          text: "A small boat drifted slowly[...] across a quiet lake[...] as the morning sun rose gently[...] over the hills. [...] A young girl sat inside[...] holding the sides carefully[...] watching the water ripple[...] with every small movement.",
        },
      ],
    },
    {
      id: "para_2",
      chunks: [
        {
          id: "para_2_chunk_1",
          text: "After some time[...] the wind picked up slightly[...] and the boat began to move faster. [...] She felt a little afraid[...] but stayed calm[...] remembering what her father had taught her. [...] She adjusted her balance[...] and let the boat follow the flow[...] instead of fighting it.",
        },
      ],
    },
    {
      id: "para_3",
      chunks: [
        {
          id: "para_3_chunk_1",
          text: "Soon[...] the wind became gentle again[...] and the lake grew still. [...] The girl looked around[...] feeling proud and peaceful[...] as she guided the boat back to shore. [...] She stepped out slowly[...] knowing she had learned something new.",
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
