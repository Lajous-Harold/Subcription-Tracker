import { logger } from '../../core/logger';
import { SessionModel, UserModel } from '../auth/models';
import { BankAccountModel, BankLinkModel, ConnectSessionModel, type BankLinkDoc } from '../bank/models';
import { deleteRemoteBankData } from '../bank/service';
import { CandidateModel } from '../detection/model';
import { PaymentModel, SubscriptionModel } from '../subscriptions/models';
import { TransactionModel } from '../transactions/model';

/**
 * Rejouable étape par étape : Powens d'abord (mis en file de nouvel essai en cas d'échec),
 * puis les données locales, et l'utilisateur en dernier. Ne résilie aucun contrat chez les fournisseurs.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const link = await BankLinkModel.findOne({ userId }).lean<BankLinkDoc>();
  if (link) await deleteRemoteBankData(link);

  await Promise.all([
    PaymentModel.deleteMany({ userId }),
    SubscriptionModel.deleteMany({ userId }),
    CandidateModel.deleteMany({ userId }),
    TransactionModel.deleteMany({ userId }),
    BankAccountModel.deleteMany({ userId }),
    BankLinkModel.deleteMany({ userId }),
    ConnectSessionModel.deleteMany({ userId }),
  ]);
  await SessionModel.deleteMany({ userId });
  await UserModel.deleteOne({ _id: userId });
  logger.info('Compte supprimé');
}
