// Styles for /lib/components/data/notifications.jsx component
export const notificationsStyles = /* css */ `
.notifications {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: 5px;
}
.notification-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 8px;
  background-color: var(--red);
  border: none;
  border-radius: var(--item-radius);
  color: var(--white);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: background-color 160ms var(--transition-easing),
              transform 160ms var(--transition-easing);
}
.notification-pill:hover {
  filter: brightness(1.2);
  transform: translateY(-1px);
}
.notification-pill:active {
  transform: translateY(0);
}
.notification-pill:focus {
  outline: none;
  box-shadow: var(--focus-ring);
}
.simple-bar--no-color-in-data .notification-pill {
  background-color: var(--minor);
  color: var(--foreground);
}
.simple-bar--widgets-background-color-as-foreground .notification-pill {
  background-color: transparent;
  color: var(--red);
  border: 1px solid var(--red);
}
.simple-bar--widgets-background-color-as-foreground .notification-pill:hover {
  background-color: var(--red);
  color: var(--white);
}
.notification-pill__icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
  flex-shrink: 0;
}
.notification-pill__badge {
  background-color: rgba(0, 0, 0, 0.3);
  color: var(--white);
  padding: 1px 5px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  min-width: 8px;
  text-align: center;
}
.simple-bar--widgets-background-color-as-foreground .notification-pill__badge {
  background-color: var(--red);
  color: var(--white);
}
`;
