import { useEffect, useState } from "react";

export const ROUTES = ["overview", "tasks", "insights", "settings"] as const;
export type Route = (typeof ROUTES)[number];

function parseRoute(): Route {
  const name = window.location.hash.replace(/^#\/?/, "");
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : "overview";
}

// Tiny hash router (#/tasks) so we don't need a routing library.
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(parseRoute);

  useEffect(() => {
    const onChange = () => setRoute(parseRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
