import React, { useState } from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';

import './NavItem.css';

export const NavItem = ({ path, onClick, img, border, text, color, showText }) => {
  const [isActive, setIsActive] = useState(showText);

  const activeStyle = {
    backgroundColor: color,
    color: 'white',
  };

  if (path) {
    return (
      <Link
        to={path}
        style={isActive ? activeStyle : {}}
        className={classNames('nav-item', { 'nav-item--active': isActive })}
        onMouseEnter={() => setIsActive(true)}
        onMouseLeave={() => setIsActive(false)}
        onClick={onClick}
      >
        <img src={require(`../assets/${img}`)} className={classNames('nav-logo', { 'bordered': border })} alt={text} />
        <span>{text}</span>
      </Link>
    );
  }

  return (
    <img
      src={require(`../assets/${img}`)}
      onClick={onClick}
      className={classNames('nav-logo', { 'bordered': border })}
      alt={text}
      style={{borderRadius: '50%'}}
    />
  )
};
