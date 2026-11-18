import { router } from 'expo-router';

export const ADD_SUBSCRIPTION_LABEL = 'Ajouter un abonnement';

export const openNewSubscription = () => router.push('/subscriptions/new');
