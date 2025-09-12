// FlatCard.tsx
import * as React from "react";

/**
 * FlatCard (flat/opaque surfaces)
 * - Solid color OR gradient background
 * - Border weight + custom border color, hover border color, active (press) border color
 * - Optional interactive motion (hover/active scale)
 * No "chrome" effects here.
 */

type Size = "sm" | "md" | "lg";
type Shadow = "none" | "sm" | "lg";
type BorderWeight = "none" | "thin" | "thick";
type GradDir = "r" | "b" | "tr" | "br";

type Gradient = {
  from: string;
  to: string;
  direction?: GradDir; // 'r'|'b'|'tr'|'br'
};

type FlatBaseProps = Omit<React.HTMLAttributes<HTMLDivElement>, "color"> & {
  size?: Size;
  interactive?: boolean;     // enables hover/active scale
  shadow?: Shadow;           // outer shadow
  border?: BorderWeight;     // none | thin (1px) | thick (2px)
  borderColor?: string;      // base border color
  hoverBorderColor?: string; // border color on hover
  activeBorderColor?: string;// border color on active/press
  className?: string;
  children?: React.ReactNode;
};

type FlatColorProps = FlatBaseProps & {
  color: string;
  gradient?: never;
};

type FlatGradientProps = FlatBaseProps & {
  gradient: Gradient;
  color?: never;
};

export type FlatCardProps = FlatColorProps | FlatGradientProps;

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

const sizePad: Record<Size, string> = {
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const shadowCls: Record<Shadow, string> = {
  none: "shadow-none",
  sm: "shadow-lg",
  lg: "shadow-xl",
};

const borderWeightCls: Record<BorderWeight, string> = {
  none: "border-0",
  thin: "border",
  thick: "border-2",
};

const motionInteractiveBase =
  "cursor-pointer transition-transform duration-200 will-change-transform";
const motionScale = "hover:scale-[1.02] active:scale-[0.98]";

// Anti-aliasing classes to prevent blurriness during transforms
const antiAlias = "transform-gpu backface-hidden perspective-1000";

function cssGradientDirection(d?: GradDir): string {
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

export const FlatCard = React.forwardRef<HTMLDivElement, FlatCardProps>(
  (props, ref) => {
    const {
      size = "md",
      interactive = true,
      shadow = "sm",
      border = "thin",
      borderColor,
      hoverBorderColor,
      activeBorderColor,
      className,
      children,
      style,
      ...rest
    } = props as FlatCardProps;

    const base = cx(
      "relative overflow-hidden rounded-2xl transition-all duration-300",
      sizePad[size],
      shadowCls[shadow],
      borderWeightCls[border],
      antiAlias
    );

    // Background: solid or gradient (fallback to soft white)
    const backgroundStyle: React.CSSProperties =
      "gradient" in rest && rest.gradient
        ? {
            backgroundImage: `linear-gradient(to ${cssGradientDirection(
              rest.gradient.direction
            )}, ${rest.gradient.from}, ${rest.gradient.to})`,
          }
        : "color" in rest && rest.color
        ? { backgroundColor: rest.color }
        : { backgroundColor: "rgba(255,255,255,0.6)" };

    // Border color variables (used by Tailwind arbitrary values)
    const varStyle: React.CSSProperties = {
      ...(borderColor ? { ["--fc-border-color" as any]: borderColor } : {}),
      ...(hoverBorderColor ? { ["--fc-hover-border-color" as any]: hoverBorderColor } : {}),
      ...(activeBorderColor ? { ["--fc-active-border-color" as any]: activeBorderColor } : {}),
    };

    const borderColorClasses = cx(
      border !== "none" && borderColor && "border-[var(--fc-border-color)]",
      border !== "none" && hoverBorderColor && "hover:border-[var(--fc-hover-border-color)]",
      border !== "none" && activeBorderColor && "active:border-[var(--fc-active-border-color)]"
    );

    const motionClasses = interactive ? cx(motionInteractiveBase, motionScale) : "";

    const classes = cx(
      base,
      borderColorClasses,
      motionClasses,
      className
    );

    return (
      <div
        ref={ref}
        className={classes}
        style={{ ...backgroundStyle, ...varStyle, ...(style || {}) }}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

FlatCard.displayName = "FlatCard";
export default FlatCard;
