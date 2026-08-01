export function setupDraftPage() {
  document.body.innerHTML = `
    <div class="DraftablePlayersTable-Mobile_draftable-players">
      <div class="BaseTable__body">
        <div class="BaseTable__row">
          <div class="BaseTable__row-cell" style="width: 60px;"><button class="QueueIcon_queue-button">★</button></div>
          <div class="BaseTable__row-cell" style="width: 100px;">1</div>
          <div class="BaseTable__row-cell" style="width: 200px;">
            <div class="PlayerCell_player-cell">
              <div class="PlayerCell_player-details-container">
                <div class="PlayerCell_player-name-container">
                  <div class="PlayerCell_player-name">Josh Allen</div>
                </div>
                <div class="PlayerCell_player-position-and-team">
                  <div class="player-position">QB</div>
                  <div class="PlayerCell_player-team"><div>BUF</div></div>
                </div>
              </div>
            </div>
          </div>
          <div class="BaseTable__row-cell" style="width: 100px;"><button>Draft</button></div>
          <div class="BaseTable__row-cell" style="width: 100px;"><span class="NumberCell_number-cell"><span>7</span></span></div>
          <div class="BaseTable__row-cell" style="width: 75px;"><span class="NumberCell_number-cell"><span>25.4</span></span></div>
        </div>
        <div class="BaseTable__row">
          <div class="BaseTable__row-cell" style="width: 60px;"><button class="QueueIcon_queue-button">★</button></div>
          <div class="BaseTable__row-cell" style="width: 100px;">2</div>
          <div class="BaseTable__row-cell" style="width: 200px;">
            <div class="PlayerCell_player-cell">
              <div class="PlayerCell_player-details-container">
                <div class="PlayerCell_player-name-container">
                  <div class="PlayerCell_player-name">Ja'Marr Chase</div>
                </div>
                <div class="PlayerCell_player-position-and-team">
                  <div class="player-position">WR</div>
                  <div class="PlayerCell_player-team"><div>CIN</div></div>
                </div>
              </div>
            </div>
          </div>
          <div class="BaseTable__row-cell" style="width: 100px;"><button>Draft</button></div>
          <div class="BaseTable__row-cell" style="width: 100px;"><span class="NumberCell_number-cell"><span>6</span></span></div>
          <div class="BaseTable__row-cell" style="width: 75px;"><span class="NumberCell_number-cell"><span>3.0</span></span></div>
        </div>
        <div class="BaseTable__row">
          <div class="BaseTable__row-cell" style="width: 60px;"><button class="QueueIcon_queue-button">★</button></div>
          <div class="BaseTable__row-cell" style="width: 100px;">3</div>
          <div class="BaseTable__row-cell" style="width: 200px;">
            <div class="PlayerCell_player-cell">
              <div class="PlayerCell_player-details-container">
                <div class="PlayerCell_player-name-container">
                  <div class="PlayerCell_player-name">Joe Burrow</div>
                </div>
                <div class="PlayerCell_player-position-and-team">
                  <div class="player-position">QB</div>
                  <div class="PlayerCell_player-team"><div>CIN</div></div>
                </div>
              </div>
            </div>
          </div>
          <div class="BaseTable__row-cell" style="width: 100px;"><button>Draft</button></div>
          <div class="BaseTable__row-cell" style="width: 100px;"><span class="NumberCell_number-cell"><span>6</span></span></div>
          <div class="BaseTable__row-cell" style="width: 75px;"><span class="NumberCell_number-cell"><span>55.6</span></span></div>
        </div>
        <div class="BaseTable__row">
          <div class="BaseTable__row-cell" style="width: 60px;"><button class="QueueIcon_queue-button">★</button></div>
          <div class="BaseTable__row-cell" style="width: 100px;">4</div>
          <div class="BaseTable__row-cell" style="width: 200px;">
            <div class="PlayerCell_player-cell">
              <div class="PlayerCell_player-details-container">
                <div class="PlayerCell_player-name-container">
                  <div class="PlayerCell_player-name">Amon-Ra St. Brown</div>
                </div>
                <div class="PlayerCell_player-position-and-team">
                  <div class="player-position">WR</div>
                  <div class="PlayerCell_player-team"><div>DET</div></div>
                </div>
              </div>
            </div>
          </div>
          <div class="BaseTable__row-cell" style="width: 100px;"><button>Draft</button></div>
          <div class="BaseTable__row-cell" style="width: 100px;"><span class="NumberCell_number-cell"><span>6</span></span></div>
          <div class="BaseTable__row-cell" style="width: 75px;"><span class="NumberCell_number-cell"><span>7.0</span></span></div>
        </div>
        <div class="BaseTable__row">
          <div class="BaseTable__row-cell" style="width: 60px;"><button class="QueueIcon_queue-button">★</button></div>
          <div class="BaseTable__row-cell" style="width: 100px;">5</div>
          <div class="BaseTable__row-cell" style="width: 200px;">
            <div class="PlayerCell_player-cell">
              <div class="PlayerCell_player-details-container">
                <div class="PlayerCell_player-name-container">
                  <div class="PlayerCell_player-name">Jared Goff</div>
                </div>
                <div class="PlayerCell_player-position-and-team">
                  <div class="player-position">QB</div>
                  <div class="PlayerCell_player-team"><div>DET</div></div>
                </div>
              </div>
            </div>
          </div>
          <div class="BaseTable__row-cell" style="width: 100px;"><button>Draft</button></div>
          <div class="BaseTable__row-cell" style="width: 100px;"><span class="NumberCell_number-cell"><span>6</span></span></div>
          <div class="BaseTable__row-cell" style="width: 75px;"><span class="NumberCell_number-cell"><span>102.8</span></span></div>
        </div>
      </div>
    </div>
    <div class="RosterTable_roster-body">
      <div class="BaseTable__body">
        <div class="BaseTable__row">
          <div class="BaseTable__row-cell">WR</div>
          <div class="BaseTable__row-cell">Ja'Marr Chase</div>
          <div class="BaseTable__row-cell">6</div>
        </div>
      </div>
    </div>
  `;
}
