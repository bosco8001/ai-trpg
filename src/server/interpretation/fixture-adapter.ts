import type { TextModelAdapter } from "../llm/contracts.js";
import type { CandidateAction } from "../../shared/interpretation.js";

type Fields = Omit<CandidateAction, "originalText">;
const fixtures: Record<string, Fields> = {
  "我慢慢走向森林裡的廢墟。": {
    status: "candidate", kind: "move", target: "森林裡的廢墟", manner: "慢慢", clarificationQuestion: null,
  },
  "我仔細查看門上的符號。": {
    status: "candidate", kind: "inspect", target: "門上的符號", manner: "仔細", clarificationQuestion: null,
  },
  "我用它攻擊那個東西。": {
    status: "clarification-needed", kind: "other", target: null, manner: null,
    clarificationQuestion: "「它」和「那個東西」分別指什麼？",
  },
  "我走向門口。": {
    status: "candidate", kind: "move", target: "門口", manner: null, clarificationQuestion: null,
  },
};

/** 僅供工程與人工檢查的固定路徑；未知句子明示未支援，不猜測。 */
export class FixtureInterpretationAdapter implements TextModelAdapter {
  async generateText(request: { readonly input: string }): Promise<unknown> {
    const fields = fixtures[request.input] ?? {
      status: "unsupported", kind: "other", target: null, manner: null, clarificationQuestion: null,
    };
    return { text: JSON.stringify(fields) };
  }
}
