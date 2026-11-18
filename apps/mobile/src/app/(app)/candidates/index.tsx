import { Redirect } from 'expo-router';

/** Ancienne adresse de la file des détections, gardée pour les liens existants. */
export default function CandidatesRedirect() {
  return <Redirect href="/review" />;
}
