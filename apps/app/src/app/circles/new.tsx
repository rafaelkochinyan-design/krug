import { MAX_CAPACITY, MAX_WEEKS, MIN_CAPACITY, MIN_WEEKS } from '@krug/domain/limits';
import { LOCALES, type Locale } from '@krug/i18n';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { api, RequestError, unwrap } from '@/lib/api';
import { WEEKDAYS, weekdayKey, type Weekday } from '@/lib/format';
import { currentLocale } from '@/lib/i18n';
import { Button, Chips, Screen, Text, TextField, useErrorText } from '@/ui';

interface Form {
  title: string;
  activity: string;
  language: Locale;
  weekday: Weekday;
  startTime: string;
  weeks: string;
  capacity: string;
  venueText: string;
  startDate: string;
  chatLink: string;
}
type Field = keyof Form;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function NewCircle() {
  const { t } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const errorText = useErrorText();
  const [form, setForm] = useState<Form>({
    title: '',
    activity: '',
    language: currentLocale(),
    weekday: 4,
    startTime: '19:30',
    weeks: '8',
    capacity: '8',
    venueText: '',
    startDate: '',
    chatLink: '',
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const set =
    <K extends Field>(k: K) =>
    (v: Form[K]) =>
      setForm((f) => ({ ...f, [k]: v }));

  // Same rules as the API; the API stays the authority and its field errors are shown too.
  const validate = (): Partial<Record<Field, string>> => {
    const e: Partial<Record<Field, string>> = {};
    if (!form.title.trim()) e.title = t('errors.required');
    if (!form.activity.trim()) e.activity = t('errors.required');
    if (!TIME.test(form.startTime)) e.startTime = t('errors.time');
    const weeks = Number(form.weeks);
    if (!Number.isInteger(weeks) || weeks < MIN_WEEKS || weeks > MAX_WEEKS)
      e.weeks = `${MIN_WEEKS}–${MAX_WEEKS}`;
    const cap = Number(form.capacity);
    if (!Number.isInteger(cap) || cap < MIN_CAPACITY || cap > MAX_CAPACITY)
      e.capacity = `${MIN_CAPACITY}–${MAX_CAPACITY}`;
    if (form.startDate && !DATE.test(form.startDate)) e.startDate = t('errors.date');
    if (form.chatLink && !/^https:\/\/\S+$/.test(form.chatLink)) e.chatLink = t('errors.url');
    return e;
  };

  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/circles', {
          body: {
            title: form.title.trim(),
            activity: form.activity.trim(),
            language: form.language,
            weekday: form.weekday,
            startTime: form.startTime,
            weeks: Number(form.weeks),
            capacity: Number(form.capacity),
            venueText: form.venueText.trim() || undefined,
            startDate: form.startDate || undefined,
            chatLink: form.chatLink.trim() || undefined,
          },
        }),
      ),
    onSuccess: (detail) => {
      qc.setQueryData(['circle', detail.circle.id], detail);
      router.replace({ pathname: '/circles/[id]', params: { id: detail.circle.id, created: '1' } });
    },
    onError: (err) => {
      if (err instanceof RequestError) {
        const server = err.fieldErrors();
        setErrors(Object.fromEntries(Object.keys(server).map((k) => [k, t('errors.validation')])));
      }
    },
  });

  const submit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length === 0) create.mutate();
  };

  const field = (
    k: Field,
    label: string,
    extra: Partial<ComponentProps<typeof TextField>> = {},
  ) => (
    <TextField
      label={label}
      value={form[k] as string}
      onChangeText={set(k) as (v: string) => void}
      error={errors[k]}
      {...extra}
    />
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: t('circle.form.title') }} />
      {field('title', t('circle.form.name'), { maxLength: 80 })}
      {field('activity', t('circle.form.activity'), { maxLength: 60 })}
      <Chips<Locale>
        label={t('circleExtra.language')}
        options={LOCALES.map((l) => ({ value: l, label: t(`language.${l}`) }))}
        value={form.language}
        onChange={set('language')}
      />
      <Chips<Weekday>
        label={t('circle.form.weekday')}
        options={WEEKDAYS.map((d) => ({ value: d, label: t(`weekdayShort.${weekdayKey(d)}`) }))}
        value={form.weekday}
        onChange={set('weekday')}
      />
      {field('startTime', t('circle.form.time'), {
        placeholder: '19:30',
        inputMode: 'numeric',
        maxLength: 5,
      })}
      {field('weeks', t('circle.form.weeks'), { inputMode: 'numeric', maxLength: 2 })}
      {field('capacity', t('circle.form.capacity'), { inputMode: 'numeric', maxLength: 2 })}
      {field('venueText', `${t('circle.form.venue')} (${t('common.optional')})`, {
        maxLength: 200,
      })}
      {field('startDate', `${t('circle.form.startDate')} (${t('common.optional')})`, {
        placeholder: '2026-11-20',
        maxLength: 10,
      })}
      {field('chatLink', t('circleExtra.chatLink'), {
        placeholder: t('circleExtra.chatLinkHint'),
        autoCapitalize: 'none',
        autoCorrect: false,
        inputMode: 'url',
      })}
      {create.isError ? (
        <Text color="danger" accessibilityRole="alert">
          {errorText(create.error)}
        </Text>
      ) : null}
      <Button
        testID="submit-circle"
        title={t('circle.form.submit')}
        onPress={submit}
        loading={create.isPending}
      />
    </Screen>
  );
}
