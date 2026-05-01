import { useEffect, useState } from 'react';

export function useApi(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let isMounted = true;

    setState({ data: null, loading: true, error: null });
    loader()
      .then((payload) => {
        if (isMounted) setState({ data: payload.data, loading: false, error: null });
      })
      .catch((error) => {
        if (isMounted) setState({ data: null, loading: false, error });
      });

    return () => {
      isMounted = false;
    };
  }, [loader]);

  return state;
}
