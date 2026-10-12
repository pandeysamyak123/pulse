// Page transition: every route fades and rises in (pure CSS — visible without JS).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="enter">{children}</div>;
}
