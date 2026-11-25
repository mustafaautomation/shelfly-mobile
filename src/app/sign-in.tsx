import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { DEMO_ACCOUNTS } from '@/data/demoAccounts';
import { messageOf } from '@/domain/errors';
import { Body, Button, Chip, ChipRow, Notice, Screen, Small, StackHeader, TextField, Title } from '@/ui/components';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export default function SignInScreen() {
  const { signIn, mode } = useWorkspace();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function submit(nextEmail = email, nextPassword = password) {
    if (!nextEmail.includes('@') || nextPassword.length === 0) {
      setError('Enter the email and password for your Shelfly seat.');
      return;
    }
    setBusy(true);
    setError(null);
    signIn(nextEmail, nextPassword)
      .then(() => router.replace('/home'))
      .catch((reason: unknown) => {
        setError(messageOf(reason, 'Sign in did not finish.'));
        setBusy(false);
      });
  }

  return (
    <Screen testID="sign-in">
      <StackHeader title="Sign in" fallback="/" />
      <Title>Back to the floor</Title>
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="you@company.com" keyboardType="email-address" />
      <TextField label="Password" value={password} onChangeText={setPassword} secure placeholder="Password" onSubmitEditing={() => submit()} />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button label="Sign in" busy={busy} onPress={() => submit()} />
      <Button label="Email me a link instead" variant="ghost" onPress={() => router.push('/magic')} />
      {mode === 'mock' ? (
        <View style={{ gap: 8 }}>
          <Small>Demo seats. The password for each is shelfly-demo, and they only exist on this device.</Small>
          <ChipRow>
            {DEMO_ACCOUNTS.map((account) => (
              <Chip
                key={account.email}
                label={account.name}
                sub={account.roleLabel}
                selected={email === account.email}
                action
                accessibilityLabel={`Use ${account.name}`}
                onPress={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  submit(account.email, account.password);
                }}
              />
            ))}
          </ChipRow>
        </View>
      ) : (
        <Body>Use the same email and password as the Shelfly web app.</Body>
      )}
    </Screen>
  );
}
