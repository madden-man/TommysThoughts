import React, { useState } from 'react';
import { NavItem } from './NavItem';
import './header.css'

export const Header = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const onClick = () => setIsExpanded(false);

  return (
    <div className="header-spacer">
        <div className={isExpanded ? "header-holder expanded dark" : "header-holder not-expanded dark"}>
            <div className="header">
            <NavItem text="Home" img="tommy_real.jpg" path="/" color="darkgreen" border={true} />
            {window.innerWidth > 768 ? (
                <div style={{ display: 'inline-flex', justifyContent: 'flex-end', width: '100%' }}>
                <NavItem text="Thoughts" img="air-symbol.jpg" color="#286977" path="/air" onClick={onClick} />
                <NavItem text="Stories" img="water-symbol.jpg" color="#24435c" path="/water" onClick={onClick}/>
                <NavItem text="Poetry" img="fire-symbol.jpg" color="#671414" path="/poetry" onClick={onClick}/>
                <NavItem text="Projects" img="earth-symbol.jpg" color="#00380a" path="/earth" onClick={onClick}/>
                <NavItem text="Memories" img="stories.png" path="/stories" color="darkgreen" border={true} onClick={onClick} />
                <NavItem text="Options" img="settings-24px.svg" path="/options" color="darkgreen" border={true} onClick={onClick} />
                </div>
            ) : <div>
                {!isExpanded && <NavItem img="menu-black.png" onClick={() => setIsExpanded(!isExpanded)} />}
                {isExpanded && <NavItem img="cancel-24px.svg" onClick={() => setIsExpanded(!isExpanded)} />}
            </div>}
            </div>
            {isExpanded && <div>
            <NavItem text="Thoughts" img="air-symbol.jpg" color="#286977" path="/air" showText onClick={onClick} />
            <NavItem text="Stories" img="water-symbol.jpg" color="#24435c" path="/water" showText onClick={onClick} />
            <NavItem text="Poetry" img="fire-symbol.jpg" color="#671414" path="/poetry" showText onClick={onClick} />
            <NavItem text="Projects" img="earth-symbol.jpg" color="#00380a" path="/earth" showText onClick={onClick} />
            <NavItem text="Memories" img="stories.png" path="/stories" color="darkgreen" border={true} showText onClick={onClick}  />
            <NavItem text="Options" img="settings-24px.svg" path="/options" color="darkgreen" border={true} showText onClick={onClick} />
            </div>}
        </div>
    </div>
  );
};
