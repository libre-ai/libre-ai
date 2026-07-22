import { StatusMessage } from "@libre-ai/ui";
import { useQuestionnaire } from "../client/use-questionnaire";
import type { LocalResponseStore } from "../persistence/local-response-store";
import { QUESTIONNAIRE_STATEMENTS } from "./fixture";
import { Questionnaire } from "./questionnaire";

export function QuestionnaireApp({ store }: { readonly store?: LocalResponseStore }) {
  const controller = useQuestionnaire(store);
  return (
    <>
      {controller.status === "corrupt" ? (
        <StatusMessage className="lai-status" data-testid="corrupt-notice">
          Vos réponses locales sont illisibles. Recommencez le questionnaire.
        </StatusMessage>
      ) : null}
      <Questionnaire
        statements={QUESTIONNAIRE_STATEMENTS}
        responses={controller.set.responses}
        onAnswer={store ? controller.answer : undefined}
        onSkip={store ? controller.skip : undefined}
      />
    </>
  );
}
