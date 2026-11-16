import { createContext, use, useCallback, useMemo, useState, type PropsWithChildren } from 'react';
import { Snackbar } from 'react-native-paper';

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = use(ToastContext);
  if (!value) throw new Error('useToast doit être utilisé dans <ToastProvider>');
  return value;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback((text: string) => setMessage(text), []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext value={value}>
      {children}
      <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={4000} action={{ label: 'OK' }}>
        {message ?? ''}
      </Snackbar>
    </ToastContext>
  );
}
