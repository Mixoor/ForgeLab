import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { documentQueue } from "../queues/documentQueue";

const serverAdapter = new ExpressAdapter();

createBullBoard({
  queues: [new BullMQAdapter(documentQueue)],
  serverAdapter: serverAdapter,
});

serverAdapter.setBasePath("/admin/queues");

export { serverAdapter };
