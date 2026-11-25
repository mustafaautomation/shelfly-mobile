import { router } from 'expo-router';

import { Body, Button, Screen, Title } from '@/ui/components';
import { useWorkspace } from '@/workspace/WorkspaceProvider';

export default function NotFoundScreen() {
  const { actor } = useWorkspace();
  return (
    <Screen>
      <Title>Empty shelf</Title>
      <Body>That link does not point at anything in Shelfly. It may be from another workspace or an old label.</Body>
      <Button label={actor ? 'Back to home' : 'Back to the start'} onPress={() => router.replace(actor ? '/home' : '/')} />
    </Screen>
  );
}
