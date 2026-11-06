import { getT } from '@/i18n/get-t';
import type { Locale } from '@/i18n/locales';
import type { ApplicationView } from '@/server/spine-views';
import { messageFor } from './ui';

/** Describe the saved decision and recipient, never an unsaved edit to the form. */
export function ApplicationStatus({
  application,
  locale,
}: {
  application: ApplicationView;
  locale: Locale;
}) {
  const t = getT(locale);
  const email = application.answers.q_signatory_email;
  const awaitingSigner =
    application.decision === 'manual_review' &&
    application.reasons.includes('signatory_required') &&
    application.answers.q_can_sign === 'no' &&
    typeof email === 'string';
  const otherReasons = application.reasons.filter(
    (reason) => !awaitingSigner || reason !== 'signatory_required'
  );

  return (
    <div className="mt-6" role="status">
      <h3 className="font-semibold">
        {awaitingSigner && otherReasons.length === 0
          ? t('spine.signatory.waiting')
          : messageFor(locale, 'spine.' + application.decision)}
      </h3>
      {awaitingSigner ? (
        <div className="mt-3 space-y-2">
          <p className="break-words font-medium">{t('spine.signatory.recipient', { email })}</p>
          <p>{t('spine.signatory.state')}</p>
          <p>{t('spine.signatory.next')}</p>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {t('spine.signatory.demoLimit')}
          </p>
        </div>
      ) : null}
      {otherReasons.length > 0 ? (
        <ul className="mt-2 list-disc pl-5">
          {otherReasons.map((reason) => (
            <li key={reason}>{messageFor(locale, 'spine.reason.' + reason)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
