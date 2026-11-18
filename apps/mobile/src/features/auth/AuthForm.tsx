import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { LoginBodySchema, PASSWORD_MIN_LENGTH, RegisterBodySchema } from '@subtracker/contracts';
import { AppButton } from '@/components/AppButton';
import { controlStyles, ErrorText, Muted, Panel } from '@/components/ui';
import { Wordmark } from '@/components/Wordmark';
import { useAuth } from '@/lib/auth';
import { ApiError, errorMessage } from '@/lib/http';
import { fontFamilies, useBrand } from '@/lib/theme';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { signIn, signUp } = useAuth();
  const { colors } = useBrand();
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
      <View style={styles.brand}>
        <Wordmark size={40} />
        <Text variant="titleMedium" style={styles.tagline}>
          Tout ce qui repart chaque mois, sous les yeux.
        </Text>
      </View>
      <Panel style={styles.card}>
        <Text variant="headlineSmall" accessibilityRole="header">
          {isSignUp ? 'Créer un compte' : 'Se connecter'}
        </Text>
        <TextInput
          label="E-mail"
          mode="outlined"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          outlineStyle={controlStyles.fieldOutline}
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
          outlineStyle={controlStyles.fieldOutline}
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
        {isSignUp ? (
          <Muted>{`Au moins ${PASSWORD_MIN_LENGTH} caractères, dont une majuscule, une minuscule, un chiffre et un symbole.`}</Muted>
        ) : null}
        <ErrorText message={formError} />
        <AppButton onPress={submit} loading={submitting} style={styles.submit}>
          {isSignUp ? 'Créer mon compte' : 'Se connecter'}
        </AppButton>
        <View style={styles.switch}>
          <Text variant="bodyMedium" style={{ color: colors.inkMuted }}>
            {isSignUp ? 'Déjà inscrit ?' : 'Pas encore de compte ?'}
          </Text>
          <Link href={isSignUp ? '/sign-in' : '/sign-up'} replace asChild>
            <AppButton variant="ghost" style={styles.switchButton}>
              {isSignUp ? 'Se connecter' : 'Créer un compte'}
            </AppButton>
          </Link>
        </View>
      </Panel>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  brand: { width: '100%', maxWidth: 420, gap: 12, marginBottom: 24 },
  tagline: { fontFamily: fontFamilies.displayMedium },
  card: { width: '100%', maxWidth: 420, padding: 24, gap: 4 },
  submit: { marginTop: 12 },
  switch: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  switchButton: { paddingHorizontal: 8 },
});
