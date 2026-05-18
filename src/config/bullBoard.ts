import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";

// Import the queues need for the document processing workflow
import { documentChunkingQueue } from "../queues/chunkingQueue";
import { documentEmbeddingQueue } from "../queues/embeddingQueue";
import { documentLmqQueue } from "../queues/lmqQueue";

const serverAdapter = new ExpressAdapter();

createBullBoard({
  queues: [
    new BullMQAdapter(documentChunkingQueue),
    new BullMQAdapter(documentEmbeddingQueue),
    new BullMQAdapter(documentLmqQueue),
  ],
  serverAdapter: serverAdapter,
});

serverAdapter.setBasePath("/admin/queues");

export { serverAdapter };
