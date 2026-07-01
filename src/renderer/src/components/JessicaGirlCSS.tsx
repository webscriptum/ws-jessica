import './JessicaGirlCSS.css'
import type { MascotAvatarSize } from '../../../preload/index.d'

interface Props {
  size?: MascotAvatarSize
  state?: 'idle' | 'thinking'
}

const SCALE: Record<MascotAvatarSize, number> = {
  small:  0.22,
  medium: 0.28,
  large:  0.35,
}

export default function JessicaGirlCSS({ size = 'medium', state = 'idle' }: Props): JSX.Element {
  const scale = SCALE[size]
  const displayW = Math.round(900 * scale)
  const displayH = Math.round(800 * scale)

  return (
    <div
      className={`jessica-girl-scene jessica-girl-scene--${state}`}
      style={{ width: displayW, height: displayH }}
    >
      <div className="jessica-girl-inner" style={{ transform: `scale(${scale})` }}>
        <div className="frame">
          <div className="wall">
            <div className="wall-dark wall-dark--0"></div>
            <div className="wall-dark wall-dark--1"></div>
            <div className="wall-dark wall-dark--2"></div>
            <div className="wall-dark wall-dark--3"></div>
            <div className="wall-dark wall-dark--4"></div>
            <div className="wall-dark wall-dark--5"></div>
            <div className="wall-dark wall-dark--6"></div>
            <div className="wall-dark wall-dark--7"></div>
            <div className="wall-dark wall-dark--8"></div>
            <div className="wall-light wall-light--1"></div>
            <div className="wall-light wall-light--2"></div>
            <div className="wall-light wall-light--3"></div>
            <div className="wall-light wall-light--4"></div>
            <div className="wall-light wall-light--5"></div>
            <div className="wall-light wall-light--6"></div>
          </div>
          <div className="table">
            <div className="table-top"></div>
            <div className="table-leg table-leg--front"></div>
            <div className="table-leg table-leg--back"></div>
            <div className="table-shadow"></div>
            <div className="cup">
              <div className="cup-steam">
                <div className="cup-steam-item cup-steam-item--sm"></div>
                <div className="cup-steam-item"></div>
              </div>
              <div className="cup-body"></div>
            </div>
            <div className="monitor">
              <div className="monitor-top">
                <div className="monitor-mark"></div>
              </div>
              <div className="monitor-leg"></div>
            </div>
          </div>
          <div className="chair">
            <div className="chair-body"></div>
            <div className="chair-leg"></div>
          </div>
          <div className="girl">
            <div className="girl-head">
              <div className="girl-head-face">
                <div className="girl-head-face-shadow"></div>
                <div className="girl-head-eyes">
                  <div className="girl-head-eyes-glass"></div>
                  <div className="girl-head-eyes-glass"></div>
                </div>
                <div className="girl-head-mouth"></div>
              </div>
              <div className="girl-head-neck"></div>
              <div className="girl-head-hair">
                <div className="girl-head-hair-top"></div>
                <div className="girl-head-hair-center"></div>
                <div className="girl-head-hair-quiff"></div>
              </div>
              <div className="girl-head-hair-right"></div>
              <div className="girl-head-hair-corner"></div>
              <div className="girl-head-hair-back"></div>
              <div className="girl-head-hair-crown"></div>
            </div>
            <div className="girl-body">
              <div className="girl-body-shirt"></div>
              <div className="girl-body-breast"></div>
              <div className="girl-body-collar"></div>
              <div className="girl-body-shoulder"></div>
              <div className="girl-body-hand_right">
                <div className="girl-body-hand_right-top"></div>
                <div className="girl-body-hand_right-center"></div>
                <div className="girl-body-hand_right-wrist"></div>
                <div className="girl-body-hand_right-mouse"></div>
              </div>
              <div className="girl-body-hand_left">
                <div className="girl-body-hand_left-top"></div>
                <div className="girl-body-hand_left-center"></div>
                <div className="girl-body-hand_left-wrist"></div>
                <div className="girl-body-hand_left-keyboard">
                  <div className="girl-body-hand_left-keyboard-btn"></div>
                </div>
              </div>
            </div>
            <div className="girl-leg-left">
              <div className="girl-leg-left-top"></div>
              <div className="girl-leg-left-center"></div>
              <div className="girl-leg-left-bottom"></div>
              <div className="girl-leg-left-foot"></div>
            </div>
            <div className="girl-leg-right">
              <div className="girl-leg-right-top"></div>
              <div className="girl-leg-right-center"></div>
              <div className="girl-leg-right-bottom"></div>
              <div className="girl-leg-right-foot"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
