export function useJobOffersStream(userId: string) {
  const offers = ref<JobOffer[]>([]);

  onMounted(() => {
    const api = useApi();
    const es = new EventSource(`/api/job-offers/stream/${userId}`);

    es.onmessage = (event) => {
      const offer = JSON.parse(event.data);
      offers.value.unshift(offer); // prepend → dernière offre en haut
    };

    onUnmounted(() => es.close());
  });

  return { offers };
}
