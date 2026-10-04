import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { feeAssessmentSchema, idPublicationSchema, idReviewSchema, profileCompletionSchema, requestReviewSchema, serviceSubmissionSchema, slaTransitionSchema } from '../schemas/service-foundations';
import type { FeeAssessmentInput, IdPublicationInput, IdReviewInput, ProfileCompletionInput, RequestReviewInput, ServiceSubmissionInput, SlaTransitionInput } from '../schemas/service-foundations';

/** Uses the caller's existing session client. Identity, tenant, decisions and clocks are server derived. */
export function serviceFoundationOperations(client: SupabaseClient<Database>) {
  return {
    completeProfile: async (input: ProfileCompletionInput) => {
      const parsed = profileCompletionSchema.parse(input);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try { return await client.rpc('complete_resident_profile', { p_input: parsed }).abortSignal(controller.signal); }
      finally { clearTimeout(timer); }
    },
    publishId: (input: IdPublicationInput) => client.rpc('publish_id_submission', { p_input: idPublicationSchema.parse(input) }),
    reviewId: (input: IdReviewInput) => client.rpc('review_id_submission', { p_input: idReviewSchema.parse(input) }),
    submit: (input: ServiceSubmissionInput) => client.rpc('submit_service_request', { p_input: serviceSubmissionSchema.parse(input) }),
    assessFee: (input: FeeAssessmentInput) => client.rpc('assess_service_request_fee', { p_input: feeAssessmentSchema.parse(input) }),
    reviewRequest: (input: RequestReviewInput) => client.rpc('review_service_request', { p_input: requestReviewSchema.parse(input) }),
    transitionSla: (input: SlaTransitionInput) => client.rpc('transition_service_request_sla', { p_input: slaTransitionSchema.parse(input) }),
    startPickup: (requestId: string) => client.rpc('start_pickup_payment', { p_request_id: requestId }),
    collectPickup: (requestId: string) => client.rpc('collect_pickup_payment', { p_request_id: requestId }),
  };
}
