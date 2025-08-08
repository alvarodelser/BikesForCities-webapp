import { useNavigate } from "react-router";



type LinkProps = {
    to?: string;
    onClick?: () => void;
    children: React.ReactNode;
    className?: string;
  };
  
  const Link: React.FC<LinkProps> = ({ to, onClick, children, className = "" }) => {
    const navigate = useNavigate();
  
    const handleClick = () => {
      if (onClick) onClick();
      else if (to) navigate(to);
    };
  
    return (
      <span
        role="link"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && handleClick()}
        className={`cursor-pointer text-black hover:text-[var(--yellow)] transition-colors duration-200 ${className}`}
      >
        {children}
      </span>
    );
  };
  
  export default Link;