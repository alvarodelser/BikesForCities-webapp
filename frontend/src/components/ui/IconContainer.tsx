// IconContainer.tsx
import * as React from "react";
import type { LucideIcon } from "lucide-react";

type Size = "sm" | "md" | "lg";
type GradDir = "r" | "b" | "tr" | "br";

type Gradient = {
  from: string;
  to: string;
  direction?: GradDir;
};

type BaseProps = {
  icon: LucideIcon;
  variant?: "flat" | "glass" | "outline";
  size?: Size;
  className?: string;
  disabled?: boolean;
  bouncy?: boolean;
  iconColor?: string;
  hoverIconColor?: string;
  "aria-label"?: string;
  style?: React.CSSProperties;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> &
  Omit<React.HTMLAttributes<HTMLDivElement>, "color">;

// ---- Variant-specific prop shapes ----
type FlatProps =
  | {
      variant?: "flat";
      color: string;
      gradient?: never;
      // glass/outline-only props off:
      tint?: never;
      hoverTint?: never;
      activeTint?: never;
      blurStrength?: never;
      borderColor?: never;
      hoverBorderColor?: never;
      activeBorderColor?: never;
    }
  | {
      variant?: "flat";
      gradient: Gradient;
      color?: never;
      tint?: never;
      hoverTint?: never;
      activeTint?: never;
      blurStrength?: never;
      borderColor?: never;
      hoverBorderColor?: never;
      activeBorderColor?: never;
    }
  | {
      variant?: "flat";
      color?: undefined;
      gradient?: undefined;
      tint?: never;
      hoverTint?: never;
      activeTint?: never;
      blurStrength?: never;
      borderColor?: never;
      hoverBorderColor?: never;
      activeBorderColor?: never;
    };

type GlassProps = {
  variant: "glass";
  tint?: string;         // base wash (semi-transparent)
  hoverTint?: string;    // hover-only wash
  activeTint?: string;   // press wash
  blurStrength?: "sm" | "md" | "lg";
  // flat-only props off:
  color?: never;
  gradient?: never;
  borderColor?: never;
  hoverBorderColor?: never;
  activeBorderColor?: never;
};

type OutlineProps = {
  variant: "outline";
  tint?: string;         // optional translucent wash
  hoverTint?: string;
  activeTint?: string;
  blurStrength?: "sm" | "md" | "lg";
  borderColor?: string;
  hoverBorderColor?: string;
  activeBorderColor?: string;
  // flat-only props off:
  color?: never;
  gradient?: never;
};

export type IconContainerProps = BaseProps & (FlatProps | GlassProps | OutlineProps);

// ---- internals ----
const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

const sizeCfg: Record<Size, { container: string; icon: string }> = {
  sm: { container: "w-8 h-8", icon: "w-4 h-4" },
  md: { container: "w-10 h-10", icon: "w-5 h-5" },
  lg: { container: "w-12 h-12", icon: "w-6 h-6" },
};

const blurCls: Record<NonNullable<GlassProps["blurStrength"]>, string> = {
  sm: "backdrop-blur-sm",
  md: "backdrop-blur",
  lg: "backdrop-blur-lg",
};

const motionBase = "transition-all duration-200 will-change-transform";
const motionHover = "hover:scale-110";
const motionBouncy = "active:scale-110 active:duration-150";

// Anti-aliasing classes to prevent blurriness during transforms
const antiAlias = "transform-gpu backface-hidden perspective-1000";

function cssDir(d?: GradDir): string {
  switch (d) {
    case "b":
      return "bottom";
    case "tr":
      return "top right";
    case "br":
      return "bottom right";
    case "r":
    default:
      return "right";
  }
}

export const IconContainer = React.forwardRef<HTMLButtonElement | HTMLDivElement, IconContainerProps>(
  (props, ref) => {
    const {
      icon: Icon,
      variant = "glass",
      size = "md",
      className,
      disabled = false,
      bouncy = true,
      iconColor = "white",
      hoverIconColor,
      onClick,
      style,
      "aria-label": ariaLabel,
      ...rest
    } = props;

    const Comp: any = onClick ? "button" : "div";
    const interactive = !!onClick && !disabled;
    const s = sizeCfg[size];

    // Base classes
    const baseClasses = cx(
      "rounded-full inline-flex items-center justify-center group/icon focus:outline-none",
      s.container,
      motionBase,
      antiAlias,
      disabled ? "opacity-50 cursor-not-allowed" : interactive ? "cursor-pointer" : ""
    );

    // Variant visuals + inline style assembly
    let variantClasses = "";
    const styleVars: React.CSSProperties & Record<string, any> = {};
    const bgStyle: React.CSSProperties = {};

    if (variant === "glass") {
      const v = props as IconContainerProps & GlassProps;
      const blur = blurCls[v.blurStrength ?? "md"];
      variantClasses = cx("border border-white/20 shadow", blur);

      // Store all tints as CSS custom properties for consistent specificity
      if (v.tint) styleVars["--ico-base-tint"] = v.tint;
      if (v.hoverTint) styleVars["--ico-hover-tint"] = v.hoverTint;
      if (v.activeTint) styleVars["--ico-active-tint"] = v.activeTint;

      // inner-ish polish
      styleVars.boxShadow =
        "inset 1px 1px 2px rgba(0,0,0,0.08), inset -1px -1px 2px rgba(255,255,255,0.05)";

      // apply base/hover/active bg tints when provided (using CSS custom properties)
      if (v.tint) variantClasses = cx(variantClasses, "bg-[var(--ico-base-tint)]");
      if (v.hoverTint) variantClasses = cx(variantClasses, interactive && "hover:bg-[var(--ico-hover-tint)]");
      if (v.activeTint) variantClasses = cx(variantClasses, interactive && "active:bg-[var(--ico-active-tint)]");
    } else if (variant === "outline") {
      const v = props as IconContainerProps & OutlineProps;
      const blur = blurCls[v.blurStrength ?? "md"];
      variantClasses = cx("bg-transparent border", blur);

      // base/hover/active border colors through vars
      if (v.borderColor) styleVars["--ico-border"] = v.borderColor;
      if (v.hoverBorderColor) styleVars["--ico-border-hover"] = v.hoverBorderColor;
      if (v.activeBorderColor) styleVars["--ico-border-active"] = v.activeBorderColor;

      variantClasses = cx(
        variantClasses,
        v.borderColor && "border-[var(--ico-border)]",
        !disabled && v.hoverBorderColor && "hover:border-[var(--ico-border-hover)]",
        !disabled && v.activeBorderColor && "active:border-[var(--ico-border-active)]"
      );

      // Store all tints as CSS custom properties for consistent specificity
      if (v.tint) styleVars["--ico-base-tint"] = v.tint;
      if (v.hoverTint) styleVars["--ico-hover-tint"] = v.hoverTint;
      if (v.activeTint) styleVars["--ico-active-tint"] = v.activeTint;

      // apply base/hover/active bg tints when provided (using CSS custom properties)
      if (v.tint) variantClasses = cx(variantClasses, "bg-[var(--ico-base-tint)]");
      if (v.hoverTint) variantClasses = cx(variantClasses, interactive && "hover:bg-[var(--ico-hover-tint)]");
      if (v.activeTint) variantClasses = cx(variantClasses, interactive && "active:bg-[var(--ico-active-tint)]");
    } else {
      // flat
      const v = props as IconContainerProps & FlatProps;
      variantClasses = "shadow";

      if ("gradient" in v && v.gradient) {
        bgStyle.backgroundImage = `linear-gradient(to ${cssDir(v.gradient.direction)}, ${v.gradient.from}, ${v.gradient.to})`;
      } else if ("color" in v && v.color) {
        bgStyle.backgroundColor = v.color;
      } else {
        bgStyle.backgroundColor = "rgba(255,255,255,0.6)";
      }
    }

    // Hover/active motion only if interactive
    const motionClasses = interactive ? cx(motionHover, bouncy && motionBouncy) : "";

    // Icon hover color
    if (hoverIconColor && !disabled) styleVars["--hover-icon"] = hoverIconColor;
    const iconHoverClass = hoverIconColor && interactive ? "group-hover/icon:text-[var(--hover-icon)]" : "";

    const classes = cx(baseClasses, variantClasses, motionClasses, className);

    return (
      <Comp
        ref={ref as any}
        className={classes}
        onClick={onClick as any}
        disabled={Comp === "button" ? disabled : undefined}
        aria-label={Comp === "button" ? ariaLabel : undefined}
        type={Comp === "button" ? "button" : undefined}
        style={{ ...bgStyle, ...styleVars, ...style }}
        {...rest}
      >
        <Icon className={cx(s.icon, "transition-colors duration-200 drop-shadow-sm", iconHoverClass)} style={{ color: iconColor }} />
      </Comp>
    );
  }
);

IconContainer.displayName = "IconContainer";
export default IconContainer;
