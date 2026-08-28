import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../hooks/AuthProvider';

export function SignInScreen() {
  const { signIn, signInWithEmail, loading, error } = useAuth();
  // Secondary email/password path. Google Sign-In is the route real users take;
  // this exists because Google's review infrastructure often can't complete a
  // Google Sign-In, and Play requires working reviewer credentials.
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitEmail = async () => {
    if (!emailValue.trim() || !password) return;
    setSubmitting(true);
    try {
      await signInWithEmail(emailValue, password);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4285f4" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Lead Notifier</Text>
      <Text style={styles.subtitle}>
        Sign in with the same Google account on your phone and PC to receive lead alerts instantly.
      </Text>

      <TouchableOpacity style={styles.googleButton} onPress={signIn} activeOpacity={0.85}>
        <Text style={styles.googleButtonText}>Sign in with Google</Text>
      </TouchableOpacity>

      {showEmailForm ? (
        <View style={styles.emailForm}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            value={emailValue}
            onChangeText={setEmailValue}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            onSubmitEditing={submitEmail}
          />
          <TouchableOpacity
            style={[styles.emailButton, submitting && styles.emailButtonDisabled]}
            onPress={submitEmail}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.emailButtonText}>Sign in</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setShowEmailForm(true)} activeOpacity={0.7}>
          <Text style={styles.altLink}>Sign in with email instead</Text>
        </TouchableOpacity>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8faff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    maxWidth: 300,
  },
  googleButton: {
    backgroundColor: '#4285f4',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    elevation: 2,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  altLink: {
    marginTop: 24,
    color: '#6b7280',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  emailForm: {
    marginTop: 28,
    width: '100%',
    maxWidth: 320,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#0f172a',
    marginBottom: 12,
  },
  emailButton: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  emailButtonDisabled: {
    opacity: 0.6,
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    marginTop: 16,
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
  },
});
