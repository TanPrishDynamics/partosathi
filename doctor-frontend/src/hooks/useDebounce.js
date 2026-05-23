/**
 * useDebounce — delays a value update by the given wait time.
 * Useful for search inputs to avoid firing API calls on every keystroke.
 *
 * @example
 *   const debouncedSearch = useDebounce(searchTerm, 350);
 *   useEffect(() => { fetchResults(debouncedSearch); }, [debouncedSearch]);
 */
import { useState, useEffect } from 'react';

const useDebounce = (value, delay = 350) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

export default useDebounce;
