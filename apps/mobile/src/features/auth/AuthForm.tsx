import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Button, Surface, Text, TextInput } from 'react-native-paper';
import { LoginBodySchema, RegisterBodySchema } from '@subtracker/contracts';
import { ErrorText, Muted } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ApiError, errorMessage } from '@/lib/http';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSignUp = mode === 'sign-up';

  const submit = async () => {
    setFormError(null);
    const parsed = (isSignUp ? RegisterBodySchema : LoginBodySchema).safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      if (isSignUp) await signUp(parsed.data.email, parsed.data.password);
      else await signIn(parsed.data.email, parsed.data.password);
    } catch (caught) {
      if (caught instanceof ApiError) setFieldErrors(caught.fieldErrors);
      setFormError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Surface style={styles.card} elevation={1}>
        <Text variant="headlineSmall">Subscription Tracker</Text>
        <Muted>Repérez et maîtrisez vos abonnements.</Muted>
        <Text variant="titleMedium" style={styles.title}>
          {isSignUp ? 'Créer un compte' : 'Se connecter'}
        </Text>
        <TextInput
          label="Email"
          mode="outlined"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          error={Boolean(fieldErrors.email)}
        />
        <ErrorText message={fieldErrors.email} />
        <TextInput
          label="Mot de passe"
          mode="outlined"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          error={Boolean(fieldErrors.password)}
          onSubmitEditing={submit}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword((value) => !value)}
              accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            />
          }
        />
        <ErrorText message={fieldErrors.password} />
        {isSignUp ? <Muted>Au moins 10 caractères.</Muted> : null}
        <ErrorText message={formError} />
        <Button mode="contained" onPress={submit} loading={submitting} disabled={submitting} style={styles.submit}>
          {isSignUp ? 'Créer mon compte' : 'Se connecter'}
        </Button>
        <View style={styles.switch}>
          <Link href={isSignUp ? '/sign-in' : '/sign-up'} replace asChild>
            <Button mode="text">{isSignUp ? 'J’ai déjà un compte' : 'Créer un compte'}</Button>
          </Link>
        </View>
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 420, padding: 24, borderRadius: 16, gap: 4 },
  title: { marginTop: 16, marginBottom: 8 },
  submit: { marginTop: 12 },
  switch: { alignItems: 'center', marginTop: 4 },
});
